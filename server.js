process.on('uncaughtException', (err) => {
    console.error('FATAL: Uncaught Exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Observability: Log all requests
app.use(morgan('combined'));

// 2. Security: HTTP Headers
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be loaded cross-origin
}));

// 3. Security: Strict Dynamic CORS Whitelist
const allowedOrigins = [
    'http://localhost:3000',
    'https://rink-ui.vercel.app',
    'https://instruments.startupmission.in'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        // Check strict whitelist
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        
        // Check wildcard subdomains for startupmission.in
        if (origin.endsWith('.startupmission.in') || origin === 'https://startupmission.in') {
            return callback(null, true);
        }

        // If not matched, block it
        console.warn(`🛑 CORS Blocked Request from Origin: ${origin}`);
        return callback(new Error('CORS policy violation: Origin not allowed.'));
    },
    methods: ['GET', 'OPTIONS']
}));

// 4. Performance: GZIP Compression
app.use(compression());

// 5. Orchestration: Docker Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 6. Web Server: Serve the generated JSON and images to the public
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`🚀 RINK Universal Data API running on port ${PORT}`);
    console.log(`🛡️  Strict CORS, Helmet, and Compression Enabled`);
    console.log(`📂 Serving static files from ./public`);
});
