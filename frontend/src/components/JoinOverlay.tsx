import React, { useState } from 'react';

interface JoinOverlayProps {
  isConnected: boolean;
  onJoin: (name: string) => void;
}

// Shown on top of everything until the user types a name and clicks Enter.
// Manages its own local input state — no global state needed.
export const JoinOverlay: React.FC<JoinOverlayProps> = ({ isConnected, onJoin }) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (!isConnected) return; // Don't allow join while still connecting
    onJoin(name.trim());
  };

  const btnLabel = isConnected ? 'Enter' : 'Waking up server... (~15s)';
  const btnColor = isConnected ? '#3b82f6' : '#f59e0b';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#1e293b', padding: 32, borderRadius: 12,
        textAlign: 'center', color: '#f8fafc',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ marginBottom: 20, fontFamily: 'Nunito, sans-serif' }}>
          Join the Whiteboard
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: '10px 16px', width: '80%', marginBottom: 12,
              borderRadius: 8, border: '1px solid #334155',
              background: '#0f172a', color: '#f8fafc', fontSize: 14,
            }}
          />
          <br />
          <button
            type="submit"
            style={{
              padding: '10px 24px', cursor: 'pointer',
              borderRadius: 8, border: 'none', background: btnColor,
              color: '#fff', fontWeight: 700, fontSize: 14,
              transition: 'background 0.2s',
            }}
          >
            {btnLabel}
          </button>
        </form>
      </div>
    </div>
  );
};
