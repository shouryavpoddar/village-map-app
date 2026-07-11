import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import PlotCanvasLayer from '../../../src/plot-map/components/PlotCanvasLayer';

describe('PlotCanvasLayer', () => {
  it('renders a canvas and attaches the given ref to it', () => {
    const canvasRef = createRef();
    const { container } = render(<PlotCanvasLayer canvasRef={canvasRef} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvasRef.current).toBe(canvas);
  });

  // pointer-events-none is load-bearing, not cosmetic: usePlotMapEngine's
  // delegated pointer listener on the wrapping div only works because this
  // canvas is never e.target - see onPointerDown/onPointerMove there.
  it('never intercepts pointer events, so clicks fall through to the map wrapper', () => {
    const canvasRef = createRef();
    const { container } = render(<PlotCanvasLayer canvasRef={canvasRef} />);
    expect(container.querySelector('canvas')).toHaveClass('absolute', 'inset-0', 'pointer-events-none');
  });
});
