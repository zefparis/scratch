import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { makeDb } from './db.js';
import { scratchRouter } from './routes/scratch.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const db = makeDb();

app.use(cors());
app.use(express.json());

// Helper: current balance for the demo user.
app.get('/api/me', async (req, res) => {
  try {
    const user_id = String(req.query.user_id ?? '');
    if (!user_id) return res.status(400).json({ error: 'user_id_required' });
    const user = await db.ensureDemoUser(user_id);
    res.json({ user_id: user.id, phone: user.phone, balance: user.balance_cdf });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'server_error' });
  }
});

app.use('/api/scratch', scratchRouter(db));
app.use('/api/admin', adminRouter(db));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
