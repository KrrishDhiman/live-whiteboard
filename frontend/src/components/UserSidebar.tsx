import React from 'react';
import type { ActiveUser } from '../hooks/useWhiteboardSocket';

interface UserSidebarProps {
  users: ActiveUser[];
}

// Pure presentational component.
// Receives the user array from the WebSocket hook via App.tsx props.
// React re-renders this component whenever the user list updates (join/leave).
// This is the ONLY thing React is allowed to re-render here — not the canvas.
export const UserSidebar: React.FC<UserSidebarProps> = ({ users }) => {
  const now = Date.now();

  return (
    <div style={{
      position: 'absolute', top: 15, left: 15,
      background: 'rgba(15,23,42,0.95)',
      padding: '15px 20px', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      width: 200, color: '#f8fafc',
      backdropFilter: 'blur(8px)',
      fontFamily: 'Nunito, sans-serif',
    }}>
      <h3 style={{
        margin: '0 0 15px 0', textAlign: 'center',
        fontSize: 13, textTransform: 'uppercase',
        letterSpacing: '1.5px', color: '#94a3b8', fontWeight: 800,
      }}>
        Active Users
      </h3>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {users.map((user, idx) => {
          const diffSeconds = Math.floor((now - user.joinedAt) / 1000);
          const timeString = diffSeconds < 60
            ? 'Joined just now'
            : `Joined ${Math.floor(diffSeconds / 60)} min${Math.floor(diffSeconds / 60) > 1 ? 's' : ''} ago`;

          return (
            <li key={idx} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{user.name}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{timeString}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
