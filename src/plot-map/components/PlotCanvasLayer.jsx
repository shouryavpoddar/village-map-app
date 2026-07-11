// Pure paint target - all pointer handling stays on the delegated listener
// in usePlotMapEngine.js (mapWrapRef), so this never needs to receive events.
export default function PlotCanvasLayer({ canvasRef }) {
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}
