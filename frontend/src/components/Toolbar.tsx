import React from 'react';

interface BrushColor { r: number; g: number; b: number; }

interface ToolbarProps {
  brushColor: BrushColor;
  brushSize: number;
  onColorChange: (color: BrushColor) => void;
  onSizeChange: (size: number) => void;
}

// Helper: converts hex color string to {r, g, b}
function hexToRgb(hex: string): BrushColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

// Helper: converts {r, g, b} back to hex for the color input's value
function rgbToHex({ r, g, b }: BrushColor): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Purely presentational toolbar.
// Changes here only re-render the toolbar — NOT the canvas.
export const Toolbar: React.FC<ToolbarProps> = ({ brushColor, brushSize, onColorChange, onSizeChange }) => {
  return (
    <div className="controls" style={{
      position: 'absolute', bottom: 20,
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'rgba(15,23,42,0.95)',
      padding: '10px 20px', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      fontFamily: 'Nunito, sans-serif', color: '#f8fafc',
    }}>
      <label htmlFor="colorPicker" style={{ fontSize: 13 }}>Color:</label>
      <input
        type="color"
        id="colorPicker"
        value={rgbToHex(brushColor)}
        onChange={(e) => onColorChange(hexToRgb(e.target.value))}
        style={{ cursor: 'pointer', border: 'none', background: 'none', width: 32, height: 32 }}
      />

      <label htmlFor="sizeSlider" style={{ fontSize: 13 }}>Size:</label>
      <input
        type="range"
        id="sizeSlider"
        min={1} max={30}
        value={brushSize}
        onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
        style={{ cursor: 'pointer' }}
      />
      <span style={{ fontSize: 13, minWidth: 20 }}>{brushSize}</span>
    </div>
  );
};
