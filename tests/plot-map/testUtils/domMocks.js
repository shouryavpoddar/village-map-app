import { vi } from 'vitest';

// jsdom implements neither DOMMatrix, SVG's getScreenCTM()/createSVGPoint(),
// ResizeObserver, nor canvas's 2D context (it needs the optional `canvas`
// npm package for that, which this repo doesn't install) - these are the
// browser APIs usePlotCanvas.js and usePlotMapEngine.js's transform/hit-test
// code rely on, so tests that exercise that code need to supply working
// substitutes. This is real, if minimal, 2D affine matrix math (not just
// call-recording stubs) so tests can assert on actual transformed
// coordinates, not merely "some function was called".

// Standard 2D affine matrix stored as [a c e / b d f / 0 0 1], matching the
// field names/semantics of the real DOMMatrix so `ctx.setTransform(m.a, ...)`
// and `m.a` (used as a pixels-per-world-unit scalar) work unchanged.
export class FakeDOMMatrix {
  constructor({ a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = {}) {
    Object.assign(this, { a, b, c, d, e, f });
  }

  // this.multiply(other) === this ∘ other: applying the result to a point
  // applies `other` first (closer to the point), then `this` - the same
  // composition order DOMMatrix.multiply uses.
  multiply(o) {
    return new FakeDOMMatrix({
      a: this.a * o.a + this.c * o.b,
      b: this.b * o.a + this.d * o.b,
      c: this.a * o.c + this.c * o.d,
      d: this.b * o.c + this.d * o.d,
      e: this.a * o.e + this.c * o.f + this.e,
      f: this.b * o.e + this.d * o.f + this.f,
    });
  }

  scale(sx, sy = sx) {
    return this.multiply({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
  }

  translate(tx, ty) {
    return this.multiply({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
  }

  inverse() {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    return new FakeDOMMatrix({
      a: d / det, b: -b / det, c: -c / det, d: a / det,
      e: (c * f - d * e) / det, f: (b * e - a * f) / det,
    });
  }
}

export function installDOMMatrixPolyfill() {
  globalThis.DOMMatrix = FakeDOMMatrix;
}

function makeSvgPoint() {
  const pt = {
    x: 0,
    y: 0,
    matrixTransform(m) {
      return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f };
    },
  };
  return pt;
}

// Patches SVGSVGElement's prototype with identity-transform defaults, so any
// <svg> mounted by a test (including ones created by the component under
// test, which a test can't get a handle on until after it renders) has a
// working createSVGPoint/getScreenCTM from the moment it mounts - components
// like usePlotMapEngine call getScreenCTM() as part of their first-mount
// effects, before a test would ever get a chance to configure a specific
// instance. Call this once per test file/suite; use mockSvgGeometry (below)
// afterward to override a specific mounted <svg>'s CTM for that test.
export function installSvgGeometryMock() {
  SVGSVGElement.prototype.createSVGPoint = function () { return makeSvgPoint(); };
  SVGSVGElement.prototype.getScreenCTM = function () { return new FakeDOMMatrix(); };
}

// Overrides one already-mounted <svg> element's getScreenCTM to report a
// specific fake "viewBox -> screen CSS px" matrix, so a test can simulate
// whatever pan/zoom/layout scenario it needs instead of the identity default.
export function mockSvgGeometry(svgEl, ctm = new FakeDOMMatrix()) {
  svgEl.createSVGPoint = () => makeSvgPoint();
  svgEl.getScreenCTM = vi.fn(() => ctm);
}

// A fake canvas 2D context. Path/transform methods are plain vi.fn() spies
// (for call-count/argument assertions), while fillStyle/strokeStyle/lineWidth
// are plain assignable fields like the real CanvasRenderingContext2D - except
// since those get overwritten on every draw call, a bare property alone
// can't tell a test "what style was active when THIS particular shape was
// stroked". fill()/stroke() are therefore custom vi.fn()s that additionally
// snapshot the current style onto ctx.fillCalls/strokeCalls, so tests can
// inspect per-shape styling (e.g. "was the hovered plot's stroke the hover
// width, distinct from the base width used for every other plot that frame").
// One context is cached per <canvas> element (WeakMap) so repeated
// getContext('2d') calls return the same object, matching the real API.
const canvasContexts = new WeakMap();

function createMockContext() {
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, shadowColor: '', shadowBlur: 0,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillCalls: [],
    strokeCalls: [],
  };
  ctx.fill = vi.fn(() => ctx.fillCalls.push(ctx.fillStyle));
  ctx.stroke = vi.fn(() => ctx.strokeCalls.push({
    strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth, shadowBlur: ctx.shadowBlur,
  }));
  return ctx;
}

export function installCanvasContextMock() {
  HTMLCanvasElement.prototype.getContext = vi.fn(function (type) {
    if (type !== '2d') return null;
    if (!canvasContexts.has(this)) canvasContexts.set(this, createMockContext());
    return canvasContexts.get(this);
  });
}

export function getMockCanvasContext(canvasEl) {
  return canvasContexts.get(canvasEl);
}

// A controllable fake ResizeObserver: usePlotCanvas's resize effect calls
// `resize()` once synchronously on mount regardless (so most tests never
// need to trigger it manually), but this also exposes `triggerAll()` for
// tests that want to simulate a later resize.
export function installResizeObserverMock() {
  const instances = [];
  class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
      instances.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver;
  return { triggerAll: () => instances.forEach((inst) => inst.callback([], inst)) };
}

// requestAnimationFrame queues callbacks rather than running them
// immediately, so tests can assert on scheduleRedraw's coalescing (multiple
// calls before a flush should still only queue one callback) instead of it
// being invisible behind a synchronous call.
export function installControllableRAF() {
  let queue = [];
  globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  return {
    pendingCount: () => queue.length,
    flush() {
      const pending = queue;
      queue = [];
      pending.forEach((cb) => cb(0));
    },
  };
}

// jsdom's getBoundingClientRect always returns all-zero geometry (there's no
// real layout engine) - tests that need a non-zero size (canvas sizing,
// hit-testing screen coordinates) must stub it explicitly per element.
export function mockBoundingClientRect(el, { width = 0, height = 0, top = 0, left = 0 } = {}) {
  el.getBoundingClientRect = () => ({
    width, height, top, left, right: left + width, bottom: top + height, x: left, y: top, toJSON() {},
  });
}

// jsdom doesn't implement the pointer-capture APIs at all (calling them
// throws "not a function") - usePlotMapEngine's onPointerDown/endDrag call
// mapWrap.setPointerCapture()/implicitly rely on capture semantics, so any
// test that dispatches real pointer events needs these stubbed globally.
export function installPointerCaptureStub() {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
