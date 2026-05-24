import { Router } from 'express';
import type { Db } from '../db.js';

export function adminRouter(db: Db) {
  const r = Router();

  r.get('/scratch/tickets', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size ?? '20'), 10) || 20));
      const { rows, total } = await db.listTickets(page, pageSize);
      res.json({ page, page_size: pageSize, total, rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? 'server_error' });
    }
  });

  r.get('/scratch/overview', async (_req, res) => {
    try {
      const scratch_revenue_today = await db.scratchRevenueToday();
      res.json({ scratch_revenue_today });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? 'server_error' });
    }
  });

  return r;
}
