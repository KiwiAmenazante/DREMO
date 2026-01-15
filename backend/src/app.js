import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

import { validateDniHandler } from './routes/validateDni.js';

// Load backend/.env regardless of where the process is started from.
// In Cloud Functions, environment variables are injected by Firebase,
// so loading a missing .env file is harmless.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/validate-dni', validateDniHandler);

export default app;
