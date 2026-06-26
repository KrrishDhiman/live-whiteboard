// server.mjs
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';

const SERVER_ID = Math.random().toString(36).substring(2, 9);
const PORT = process.env.PORT || 8080;

// Ensure you replace this with your actual Upstash URL in production
const REDIS_URL = process.env.REDIS_URL || 'rediss://default:gQAAAAAAAYajAAIgcDFkYjVjZjcwZTc0Zjk0YmQ0YjM2NTUzMTkyYzk4NTZmMw@balanced-grub-100003.upstash.io:6379';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.error('Redis Publisher Error:', err));
subClient.on('error', (err) => console.error('Redis Subscriber Error:', err));

await pubClient.connect();
await subClient.connect();
console.log(`Server [${SERVER_ID}] connected to Redis.`);

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket Server [${SERVER_ID}] running on port ${PORT}`);

// Map to store connected users and their join times
const activeUsers = new Map();

// ==========================================
// 1. REDIS SUBSCRIBER
// ==========================================
await subClient.subscribe('whiteboard_channel', (message) => {
    const payload = JSON.parse(message);
    if (payload.serverId === SERVER_ID) return;

    const binaryData = Buffer.from(payload.data, 'base64');
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(binaryData, { binary: true });
        }
    });
});

// ==========================================
// 2. WEBSOCKET SERVER
// ==========================================
wss.on('connection', async (ws) => {
    
    const connectionId = Math.random().toString(36).substring(2, 9);
    console.log(`New client connected! ID: ${connectionId}`);
    
    // CATCH-UP MECHANIC (EVENT SOURCING)
    const history = await pubClient.lRange('whiteboard_history', 0, -1);
    if (history.length > 0) {
        const buffers = history.map(b64 => Buffer.from(b64, 'base64'));
        const catchUpPayload = Buffer.concat(buffers);
        ws.send(catchUpPayload, { binary: true });
    }

    ws.on('message', (data, isBinary) => {
        if (isBinary) {
            // CHANNEL 1: RAW BINARY (Drawing Data)
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data, { binary: true });
                }
            });

            const base64Data = data.toString('base64');
            const payload = JSON.stringify({ serverId: SERVER_ID, data: base64Data });
            pubClient.publish('whiteboard_channel', payload);
            pubClient.rPush('whiteboard_history', base64Data);
        } else {
            // CHANNEL 2: JSON TEXT (Metadata & Users)
            const message = JSON.parse(data.toString());

            if (message.type === 'JOIN') {
                activeUsers.set(connectionId, {
                    name: message.name,
                    joinedAt: Date.now()
                });

                const userList = Array.from(activeUsers.values());
                const jsonPayload = JSON.stringify({ type: 'USER_LIST', users: userList });
                
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonPayload);
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (activeUsers.has(connectionId)) {
            activeUsers.delete(connectionId);
            console.log(`Client disconnected: ${connectionId}`);
            
            const userList = Array.from(activeUsers.values());
            const jsonPayload = JSON.stringify({ type: 'USER_LIST', users: userList });
            
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonPayload);
                }
            });
        }
    });
});