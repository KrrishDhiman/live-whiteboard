import React, { useRef, useEffect } from 'react';

interface BrushColor { r: number; g: number; b: number; }

interface CanvasProps {
  brushColor: BrushColor;
  brushSize: number;
  onStrokeReady: (buffer: ArrayBuffer) => void; // called on mouseUp to transmit
  drawRemoteRef: React.MutableRefObject<((buf: ArrayBuffer) => void) | null>;
}

// Canvas never re-renders after mount.
// All drawing is pure imperative DOM mutation via ctx + useRef.
export const Canvas: React.FC<CanvasProps> = ({
  brushColor,
  brushSize,
  onStrokeReady,
  drawRemoteRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const currentX = useRef(0);
  const currentY = useRef(0);
  // strokeBuffer accumulates segments between mousedown → mouseup
  const strokeBuffer = useRef<number[][]>([]);

  // Expose the remote draw function so App can call it when binary arrives
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.lineCap = 'round';

    // This function is called by the WebSocket hook whenever remote binary arrives
    drawRemoteRef.current = (buf: ArrayBuffer) => {
      const floats = new Float32Array(buf);
      for (let i = 0; i < floats.length; i += 8) {
        executeDraw(ctx,
          floats[i], floats[i+1], floats[i+2], floats[i+3],
          floats[i+4], floats[i+5], floats[i+6], floats[i+7]
        );
      }
    };
  }, []); // runs once on mount

  // Re-bind event listeners whenever brush settings change
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const getCoords = (e: MouseEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onMouseDown = (e: MouseEvent) => {
      isDrawing.current = true;
      const [x, y] = getCoords(e);
      currentX.current = x;
      currentY.current = y;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawing.current) return;
      const [newX, newY] = getCoords(e);
      const { r, g, b } = brushColor;

      // Draw locally — zero latency, bypasses React
      executeDraw(ctx, currentX.current, currentY.current, newX, newY, brushSize, r, g, b);

      // Buffer the stroke segment
      strokeBuffer.current.push([currentX.current, currentY.current, newX, newY, brushSize, r, g, b]);

      // Log payload size comparison for interview demo
      const binarySize = 32; // always 8 × float32 = 32 bytes
      const jsonSize = new TextEncoder().encode(JSON.stringify(strokeBuffer.current[strokeBuffer.current.length - 1])).byteLength;
      const saving = (((jsonSize - binarySize) / jsonSize) * 100).toFixed(1);
      console.log(`📦 Binary: ${binarySize}B | JSON: ${jsonSize}B | Savings: ${saving}%`);

      currentX.current = newX;
      currentY.current = newY;
    };

    const onMouseUp = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      if (strokeBuffer.current.length === 0) return;

      // Pack all buffered segments into one Float32Array and transmit
      const payload = new Float32Array(strokeBuffer.current.length * 8);
      let offset = 0;
      for (const seg of strokeBuffer.current) {
        for (const val of seg) payload[offset++] = val;
      }
      onStrokeReady(payload.buffer);
      strokeBuffer.current = [];
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseout', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseout', onMouseUp);
    };
  }, [brushColor, brushSize, onStrokeReady]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{
        background: '#fff',
        cursor: 'crosshair',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      }}
    />
  );
};

// Pure drawing function — no React involved
function executeDraw(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  size: number, r: number, g: number, b: number
) {
  ctx.beginPath();
  ctx.lineWidth = size;
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.closePath();
}
