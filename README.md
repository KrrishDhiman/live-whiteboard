# Live Whiteboard

A distributed, low-latency collaborative whiteboard.
Built for real-time synchronization across multiple clients.

Try it out yourself!! Link: https://live-whiteboard-ivory.vercel.app/

Demo GIF: (takes 5-10 seconds to load)
<img width="960" height="540" alt="2026-07-31 20-36-58 (1)" src="https://github.com/user-attachments/assets/1c9218d9-5521-4491-b2a0-c5d63d62c55d" />

## Architecture
- **Frontend**: React 19, Vite, TypeScript, HTML5 Canvas.
- **Backend**: Node.js, WebSockets (`ws`).
- **Database / PubSub**: Redis (Upstash).

<img width="1408" height="768" alt="Gemini_Generated_Image_w6y5xiw6y5xiw6y5" src="https://github.com/user-attachments/assets/0bd960f6-a42d-4503-9a63-1fda016925b0" />

## Features
- **Real-Time Drawing**: Sub-16ms latency for smooth 60fps rendering.
- **Two-World Frontend Architecture**: React manages UI panels; Canvas runs on unmanaged `useRef` to eliminate Virtual DOM overhead.
- **Event Sourcing**: Replays stroke history for late-joining users.
- **Horizontal Scaling**: Uses Redis Pub/Sub to sync multiple server instances.
- **Binary Serialization**: Transmits `Float32Array` over raw WebSockets.
- **Payload Optimization**: Achieves strict 32-byte stroke payloads (up to ~63% bandwidth reduction over JSON).
- **Auto-Reconnection**: Custom polling mitigates serverless cold-starts.

## How It Works

### The Frontend (React + Imperative Canvas)
- **Declarative UI**: React owns `<JoinOverlay />`, `<UserSidebar />`, and `<Toolbar />`.
- **Imperative Canvas**: The canvas engine runs inside `<Canvas />` using `useRef`.
- **Zero Re-Render Drawing**: Stroke rendering bypasses React state entirely to avoid garbage collection spikes.
- **Custom Hook**: `useWhiteboardSocket` encapsulates connection lifecycle, reconnect loops, and binary routing.

### The Data Flow
- User draws on the HTML5 Canvas.
- Strokes collect into a local buffer.
- On mouse-up, the buffer transmits via WebSocket.
- Data transfers as raw binary bytes.
- Server broadcasts binary directly to local peers.
- Server encodes binary to Base64 JSON.
- Server publishes JSON to a global Redis channel.
- Other servers receive the Redis broadcast.
- Other servers decode Base64 back to binary.
- Other servers broadcast binary to their local peers.

### Event Sourcing & History
- Every stroke appends to a Redis List (`whiteboard_history`).
- Appending uses `rPush` for O(1) time complexity.
- Redis handles writes with <1ms latency.
- New users request history on join.
- Server fetches history via `lRange(0, -1)`.
- Server concatenates all records into one massive buffer.
- Client receives the buffer and instantly replays all past strokes.

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- Redis instance (Local or Cloud/Upstash)

### 1. Clone & Install
```bash
git clone https://github.com/KrrishDhiman/live-whiteboard.git
cd live-whiteboard
npm install
```

### 2. Configure Environment
- Create a `.env` file in the root directory:
```env
REDIS_URL=rediss://default:password@your-redis-host:6379
PORT=8080
```

### 3. Run the Backend Server
```bash
npm start
```
- Server boots up on `localhost:8080`.

### 4. Run the Frontend Client

#### Option A: React + Vite App (Recommended)
```bash
cd frontend
npm install
npm run dev
```
- Opens the React app at `http://localhost:5173`.

#### Option B: Vanilla Client
- Open root `index.html` in your browser (or serve via VSCode Live Server).

## Deployment Strategy
- **Frontend**: Hosted on Vercel. Global CDN ensures instant static load times.
- **Backend**: Hosted on Render. Dedicated container allows persistent WebSockets.
- **Database**: Hosted on Upstash. Serverless Redis acts as the global state hub.

## Performance Metrics
- Stress-tested locally using **Artillery**.
- Handles 13,000+ concurrent WebSocket connections.
- Achieves up to 63% payload reduction via binary serialization vs JSON.
  
 <img width="960" height="509" alt="Screenshot 2026-08-11 005510" src="https://github.com/user-attachments/assets/9133ef09-0f1f-419b-8644-ffed12dd17a4" />
  
- Sustains >60fps client rendering during heavy data ingestion.

<img width="960" height="509" alt="Screenshot 2026-07-31 191224" src="https://github.com/user-attachments/assets/ca417ef1-f2c0-4879-ac67-391b1612d8df" />
