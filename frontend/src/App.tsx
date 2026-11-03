import { useState, useRef, useCallback } from 'react';
import { Canvas } from './components/Canvas';
import { JoinOverlay } from './components/JoinOverlay';
import { UserSidebar } from './components/UserSidebar';
import { Toolbar } from './components/Toolbar';
import { useWhiteboardSocket } from './hooks/useWhiteboardSocket';

interface BrushColor { r: number; g: number; b: number; }

// App.tsx is the coordinator. It holds all shared state and wires components together.
// It does NOT know how to draw — that lives in Canvas.tsx.
// It does NOT know the WebSocket protocol — that lives in the hook.
export default function App() {
  // Joined state: controls whether the overlay is shown
  const [hasJoined, setHasJoined] = useState(false);

  // Brush settings: React state here is fine because they change rarely
  const [brushColor, setBrushColor] = useState<BrushColor>({ r: 0, g: 0, b: 0 });
  const [brushSize, setBrushSize] = useState(2);

  // This ref exposes the Canvas's remote draw function to App
  // When binary arrives over WebSocket, we call this to draw it
  const drawRemoteRef = useRef<((buf: ArrayBuffer) => void) | null>(null);

  // onBinaryData: called by the hook every time a remote stroke arrives
  // We use useCallback so the hook's dependency array stays stable
  const onBinaryData = useCallback((buf: ArrayBuffer) => {
    drawRemoteRef.current?.(buf); // forward straight into canvas — no React state touched
  }, []);

  const { isConnected, activeUsers, sendBinary, sendJoin } = useWhiteboardSocket(onBinaryData);

  const handleJoin = (name: string) => {
    sendJoin(name);
    setHasJoined(true);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  background: '#222' }}>

      {/* Join overlay — only rendered until user submits a name */}
      {!hasJoined && (
        <JoinOverlay isConnected={isConnected} onJoin={handleJoin} />
      )}

      {/* User sidebar — re-renders only when activeUsers array changes */}
      {hasJoined && <UserSidebar users={activeUsers} />}

      {/* Canvas — mounts once and NEVER re-renders */}
      <Canvas
        brushColor={brushColor}
        brushSize={brushSize}
        onStrokeReady={sendBinary}
        drawRemoteRef={drawRemoteRef}
      />

      {/* Toolbar — re-renders only when color or size changes */}
      {hasJoined && (
        <Toolbar
          brushColor={brushColor}
          brushSize={brushSize}
          onColorChange={setBrushColor}
          onSizeChange={setBrushSize}
        />
      )}
    </div>
  );
}
