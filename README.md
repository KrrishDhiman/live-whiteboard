# Live Whiteboard

A distributed, low-latency collaborative whiteboard.
Built for real-time synchronization across multiple clients.

Try it out yourself!! Link: https://live-whiteboard-ivory.vercel.app/


<img width="240" height="135" alt="2026-07-31 20-36-58" src="https://github.com/user-attachments/assets/f403e19b-dab8-4563-84fa-a6d280cc3ac2" />


## Architecture
- **Frontend**: HTML5 Canvas, TypeScript, CSS.
- **Backend**: Node.js, WebSockets (`ws`).
- **Database / PubSub**: Redis.
 

<img width="352" height="192" alt="Gemini_Generated_Image_w6y5xiw6y5xiw6y5" src="https://github.com/user-attachments/assets/d7d6809a-3a4b-4009-95a6-de22d044990c" />


## Features
- **Real-Time Drawing**: Sub-16ms latency for smooth 60fps rendering.
- **Event Sourcing**: Replays stroke history for late-joining users.
- **Horizontal Scaling**: Uses Redis Pub/Sub to sync multiple server instances.
- **Binary Serialization**: Transmits `Float32Array` over raw WebSockets.
- **Payload Optimization**: Achieves strict 32-byte stroke payloads.
- **Auto-Reconnection**: Custom polling mitigates serverless cold-starts.

## How It Works

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
git clone https://github.com/yourusername/live-whiteboard.git
cd live-whiteboard
npm install
```

### 2. Configure Environment
- Create a `.env` file in the root directory.
- Add your Redis connection string:
```env
REDIS_URL=rediss://default:password@your-redis-host:6379
PORT=8080
```

### 3. Run the Server
```bash
npm start
```
- Server boots up on `localhost:8080`.

### 4. Run the Client
- Open `index.html` in your browser.
- Alternatively, serve via VSCode Live Server.

## Deployment Strategy
- **Frontend**: Hosted on Vercel. Global CDN ensures instant static load times.
- **Backend**: Hosted on Render. Dedicated container allows persistent WebSockets.
- **Database**: Hosted on Upstash. Serverless Redis acts as the global state hub.

## Performance Metrics
- Stress-tested locally using **Artillery**.
- Handles 13,000+ concurrent WebSocket connections.
- Achieves 42% payload reduction via binary serialization vs JSON.
- Sustains >60fps client rendering during heavy data ingestion.

<img width="240" height="128" alt="Screenshot 2026-07-31 191224" src="https://github.com/user-attachments/assets/b5e48a25-d71a-4103-b0e2-92502501af99" />
