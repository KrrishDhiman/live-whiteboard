import { useEffect, useRef, useState, useCallback } from 'react';

export interface ActiveUser {
  name: string;
  joinedAt: number;
}

// This hook owns the entire WebSocket lifecycle.
// It connects, reconnects automatically, parses incoming messages,
// and exposes sendBinary + sendJoin for the rest of the app.
export function useWhiteboardSocket(
  onBinaryData: (buf: ArrayBuffer) => void
) {
  const ws = useRef<WebSocket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Stable ref to onBinaryData so it doesn't trigger reconnect on every render
  const onBinaryDataRef = useRef(onBinaryData);
  useEffect(() => { onBinaryDataRef.current = onBinaryData; }, [onBinaryData]);

  const connect = useCallback(() => {
    const WS_URL =
      window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
        ? 'ws://localhost:8080'
        : 'wss://live-whiteboard-thq8.onrender.com';

    const socket = new WebSocket(WS_URL);
    socket.binaryType = 'arraybuffer';
    ws.current = socket;

    socket.onopen = () => {
      console.log('✅ Connected to backend!');
      setIsConnected(true);
    };

    socket.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
    };

    // Auto-reconnect polling — fires every 3 seconds after any close
    socket.onclose = () => {
      console.warn('⚠️ Connection lost. Retrying in 3s...');
      setIsConnected(false);
      setTimeout(connect, 3000);
    };

    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        // JSON path: only used for user list metadata
        const payload = JSON.parse(event.data);
        if (payload.type === 'USER_LIST') {
          setActiveUsers(payload.users); // Triggers React re-render of sidebar ONLY
        }
      } else {
        // Binary path: raw Float32Array stroke — passed straight to canvas
        onBinaryDataRef.current(event.data as ArrayBuffer);
      }
    };
  }, []); // connect never changes identity

  useEffect(() => {
    connect();
    // Cleanup: close socket when component unmounts (e.g., hot reload)
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  const sendBinary = useCallback((buffer: ArrayBuffer) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(buffer);
    }
  }, []);

  const sendJoin = useCallback((name: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'JOIN', name }));
    }
  }, []);

  return { isConnected, activeUsers, sendBinary, sendJoin };
}
