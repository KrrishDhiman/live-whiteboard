// app.ts
type VectorStroke = [number, number, number, number, number, number, number, number];

interface ActiveUser {
    name: string;
    joinedAt: number;
}

class CanvasEmitter {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // State
    private isDrawing: boolean = false;
    private currentX: number = 0;
    private currentY: number = 0;
    private strokeBuffer: VectorStroke[] = [];
    private activeUsers: ActiveUser[] = [];

    // Brush Settings
    private brushColor: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 };
    private brushSize: number = 2;

    // Network
    private ws!: WebSocket;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

        this.initContext();
        this.setupJoinUI(); // 1. MOVED HERE! UI binds immediately.
        this.attachEventListeners();
        this.initNetwork();
    }

    private initContext(): void {
        this.ctx.lineCap = 'round';
    }

    private initNetwork(): void {
        // 2. Hardcoded for guaranteed local testing. (We will change this when you deploy).
        // Inside initNetwork()
        const WS_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
            ? `ws://localhost:8080`
            : `https://live-whiteboard-thq8.onrender.com`; // We will get this URL in Step 2!

        this.ws = new WebSocket(WS_URL);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => console.log("✅ Connected to backend!");

        // 3. ADDED ERROR LOGGING
        this.ws.onerror = (error) => console.error("❌ Connection failed! Is Node running?", error);

        this.ws.onmessage = async (event: MessageEvent) => {
            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);
                if (data.type === 'USER_LIST') {
                    this.activeUsers = data.users;
                    this.renderUserList();
                }
            } else {
                const buffer = event.data as ArrayBuffer;
                this.handleRemoteStrokes(buffer);
            }
        };

        setInterval(() => this.renderUserList(), 30000);
    }

    private setupJoinUI(): void {
        const joinOverlay = document.getElementById('joinOverlay') as HTMLDivElement;
        const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
        const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
        const userSidebar = document.getElementById('userSidebar') as HTMLDivElement;

        if (!joinBtn) return;

        joinBtn.addEventListener('click', () => {
            const name = usernameInput.value.trim();
            if (name) {
                // 4. CHECK CONNECTION BEFORE SENDING
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'JOIN', name: name }));
                    joinOverlay.style.display = 'none';
                    userSidebar.style.display = 'block';
                } else {
                    alert("Backend not connected yet! Check terminal/console.");
                }
            }
        });
    }

    private renderUserList(): void {
        const listElement = document.getElementById('userList') as HTMLUListElement;
        if (!listElement) return;

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

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    private handleRemoteStrokes(buffer: ArrayBuffer): void {
        const floatArray = new Float32Array(buffer);
        for (let i = 0; i < floatArray.length; i += 8) {
            this.drawRemote(
                floatArray[i], floatArray[i + 1], floatArray[i + 2], floatArray[i + 3],
                floatArray[i + 4], floatArray[i + 5], floatArray[i + 6], floatArray[i + 7]
            );
        }
    }

    private getCoordinates(e: MouseEvent): [number, number] {
        const rect = this.canvas.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }

    private attachEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.onMouseUp.bind(this));

        const colorInput = document.getElementById('colorPicker') as HTMLInputElement;
        const sizeInput = document.getElementById('sizeSlider') as HTMLInputElement;

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

    private onMouseDown(e: MouseEvent): void {
        this.isDrawing = true;
        const [x, y] = this.getCoordinates(e);
        this.currentX = x;
        this.currentY = y;
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDrawing) return;
        const [newX, newY] = this.getCoordinates(e);

        this.drawLocal(
            this.currentX, this.currentY, newX, newY,
            this.brushSize, this.brushColor.r, this.brushColor.g, this.brushColor.b
        );

        this.strokeBuffer.push([
            this.currentX, this.currentY, newX, newY,
            this.brushSize, this.brushColor.r, this.brushColor.g, this.brushColor.b
        ]);

        this.currentX = newX;
        this.currentY = newY;
    }

    private onMouseUp(): void {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.transmitBuffer();
    }

    private drawLocal(x0: number, y0: number, x1: number, y1: number, size: number, r: number, g: number, b: number): void {
        this.executeDraw(x0, y0, x1, y1, size, r, g, b);
    }

    private drawRemote(x0: number, y0: number, x1: number, y1: number, size: number, r: number, g: number, b: number): void {
        this.executeDraw(x0, y0, x1, y1, size, r, g, b);
    }

    private executeDraw(x0: number, y0: number, x1: number, y1: number, size: number, r: number, g: number, b: number): void {
        this.ctx.beginPath();
        this.ctx.lineWidth = size;
        this.ctx.strokeStyle = `rgb(${r},${g},${b})`;
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.stroke();
        this.ctx.closePath();
    }

    private transmitBuffer(): void {
        if (this.strokeBuffer.length === 0 || this.ws.readyState !== WebSocket.OPEN) return;

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