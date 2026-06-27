"use strict";
class CanvasEmitter {
    canvas;
    ctx;
    // State
    isDrawing = false;
    currentX = 0;
    currentY = 0;
    strokeBuffer = [];
    activeUsers = [];
    // Brush Settings
    brushColor = { r: 0, g: 0, b: 0 };
    brushSize = 2;
    // Network
    ws;
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.initContext();
        this.setupJoinUI(); // 1. MOVED HERE! UI binds immediately.
        this.attachEventListeners();
        this.initNetwork();
    }
    initContext() {
        this.ctx.lineCap = 'round';
    }
    initNetwork() {
        // 2. Hardcoded for guaranteed local testing. (We will change this when you deploy).
        // Inside initNetwork()
        const WS_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
            ? `ws://localhost:8080`
            : `wss://live-whiteboard-thq8.onrender.com`; // We will get this URL in Step 2!
        this.ws = new WebSocket(WS_URL);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => {
            console.log("✅ Connected to backend!");
            const joinBtn = document.getElementById('joinBtn');
            if (joinBtn) {
                joinBtn.innerText = "Enter";
                joinBtn.style.backgroundColor = "";
            }
            this.setupJoinUI();
        };
        // 3. ADDED ERROR LOGGING
        this.ws.onerror = (error) => console.error("❌ Connection failed! Is Node running?", error);
        this.ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);
                if (data.type === 'USER_LIST') {
                    this.activeUsers = data.users;
                    this.renderUserList();
                }
            }
            else {
                const buffer = event.data;
                this.handleRemoteStrokes(buffer);
            }
        };
        setInterval(() => this.renderUserList(), 30000);
    }
    setupJoinUI() {
        const joinOverlay = document.getElementById('joinOverlay');
        const joinBtn = document.getElementById('joinBtn');
        const usernameInput = document.getElementById('usernameInput');
        const userSidebar = document.getElementById('userSidebar');
        if (!joinBtn)
            return;
        joinBtn.addEventListener('click', () => {
            const name = usernameInput.value.trim();
            if (name) {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'JOIN', name: name }));
                    joinOverlay.style.display = 'none';
                    userSidebar.style.display = 'block';
                }
                else if (this.ws.readyState === WebSocket.CONNECTING) {
                    joinBtn.innerText = "Waking up server... (~15s)";
                    joinBtn.style.backgroundColor = "#f59e0b";
                }
                else {
                    alert("Server connection failed. Try refreshing!");
                }
            }
        });
    }
    renderUserList() {
        const listElement = document.getElementById('userList');
        if (!listElement)
            return;
        listElement.innerHTML = '';
        const now = Date.now();
        this.activeUsers.forEach(user => {
            const li = document.createElement('li');
            // Added flexbox for cleaner vertical spacing
            li.style.marginBottom = '12px';
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            li.style.gap = '3px';
            const diffInSeconds = Math.floor((now - user.joinedAt) / 1000);
            let timeString = 'Joined just now';
            if (diffInSeconds >= 60) {
                const mins = Math.floor(diffInSeconds / 60);
                timeString = `Joined ${mins} min${mins > 1 ? 's' : ''} ago`;
            }
            // Updated typography for a cooler, modern look
            li.innerHTML = `
                <span style="font-size: 14px; font-weight: 600; color: #ffffff;">${user.name}</span>
                <span style="font-size: 11px; color: #94a3b8;">${timeString}</span>
            `;
            listElement.appendChild(li);
        });
    }
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    handleRemoteStrokes(buffer) {
        const floatArray = new Float32Array(buffer);
        for (let i = 0; i < floatArray.length; i += 8) {
            this.drawRemote(floatArray[i], floatArray[i + 1], floatArray[i + 2], floatArray[i + 3], floatArray[i + 4], floatArray[i + 5], floatArray[i + 6], floatArray[i + 7]);
        }
    }
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }
    attachEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.onMouseUp.bind(this));
        const colorInput = document.getElementById('colorPicker');
        const sizeInput = document.getElementById('sizeSlider');
        if (colorInput) {
            colorInput.addEventListener('input', () => {
                this.brushColor = this.hexToRgb(colorInput.value);
            });
        }
        if (sizeInput) {
            sizeInput.addEventListener('input', () => {
                this.brushSize = parseInt(sizeInput.value, 10);
            });
        }
    }
    onMouseDown(e) {
        this.isDrawing = true;
        const [x, y] = this.getCoordinates(e);
        this.currentX = x;
        this.currentY = y;
    }
    onMouseMove(e) {
        if (!this.isDrawing)
            return;
        const [newX, newY] = this.getCoordinates(e);
        this.drawLocal(this.currentX, this.currentY, newX, newY, this.brushSize, this.brushColor.r, this.brushColor.g, this.brushColor.b);
        this.strokeBuffer.push([
            this.currentX, this.currentY, newX, newY,
            this.brushSize, this.brushColor.r, this.brushColor.g, this.brushColor.b
        ]);
        this.currentX = newX;
        this.currentY = newY;
    }
    onMouseUp() {
        if (!this.isDrawing)
            return;
        this.isDrawing = false;
        this.transmitBuffer();
    }
    drawLocal(x0, y0, x1, y1, size, r, g, b) {
        this.executeDraw(x0, y0, x1, y1, size, r, g, b);
    }
    drawRemote(x0, y0, x1, y1, size, r, g, b) {
        this.executeDraw(x0, y0, x1, y1, size, r, g, b);
    }
    executeDraw(x0, y0, x1, y1, size, r, g, b) {
        this.ctx.beginPath();
        this.ctx.lineWidth = size;
        this.ctx.strokeStyle = `rgb(${r},${g},${b})`;
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    transmitBuffer() {
        if (this.strokeBuffer.length === 0 || this.ws.readyState !== WebSocket.OPEN)
            return;
        const binaryPayload = new Float32Array(this.strokeBuffer.length * 8);
        let offset = 0;
        for (const stroke of this.strokeBuffer) {
            binaryPayload[offset++] = stroke[0];
            binaryPayload[offset++] = stroke[1];
            binaryPayload[offset++] = stroke[2];
            binaryPayload[offset++] = stroke[3];
            binaryPayload[offset++] = stroke[4];
            binaryPayload[offset++] = stroke[5];
            binaryPayload[offset++] = stroke[6];
            binaryPayload[offset++] = stroke[7];
        }
        this.ws.send(binaryPayload.buffer);
        this.strokeBuffer = [];
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new CanvasEmitter('whiteboard');
});
