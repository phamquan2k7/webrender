import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import router from './backend/router.js';
import { sessionOps } from './backend/database.js';
import { handleWebSocketConnection } from './backend/websocket.js';
import { setupMiddleware } from './middleware.js';

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

setupMiddleware(app);

app.use('/', router);

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', handleWebSocketConnection);

setInterval(() => {
    sessionOps.cleanExpiredSessions();
}, 60 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});