import { Router } from 'express';
import type { Db } from '../db.js';
import { generateGrid } from '../scratchEngine.js';

const ALLOWED_BETS = new Set([500, 1000, 2000, 5000]);

export function scratchRouter(db: Db) {
  const r = Router();

  // POST /api/scratch/buy
  r.post('/buy', async (req, res) => {
    try {
      const { user_id, bet_amount_cdf } = req.body ?? {};
      if (!user_id) return res.status(400).json({ error: 'user_id_required' });
      const bet = Number(bet_amount_cdf);
      if (!ALLOWED_BETS.has(bet)) return res.status(400).json({ error: 'invalid_bet' });

      const user = await db.ensureDemoUser(user_id);
      if (user.balance_cdf < bet) return res.status(400).json({ error: 'insufficient_balance' });

      await db.adjustBalance(user_id, -bet);

      const { grid, win } = generateGrid(bet);
      const ticket = await db.insertTicket({
        user_id,
        bet_amount_cdf: bet,
        grid,
        win_amount_cdf: win,
        status: 'pending',
      });

      // The symbol grid is returned so the client can animate per-cell
      // reveals as the user scratches. The win_amount_cdf is computed and
      // stored server-side but is NOT exposed until /claim, so a tampered
      // client cannot short-circuit the outcome.
      return res.json({
        ticket_id: ticket.id,
        grid_hidden: true,           // flag: server considers payout hidden
        bet_amount_cdf: bet,
        grid: ticket.grid,           // symbols only, no payout info
      });
    } catch (e: any) {
      console.error('[scratch/buy]', e);
      return res.status(500).json({ error: e.message ?? 'server_error' });
    }
  });

  // POST /api/scratch/claim
  r.post('/claim', async (req, res) => {
    try {
      const { ticket_id, user_id } = req.body ?? {};
      if (!ticket_id || !user_id) return res.status(400).json({ error: 'bad_request' });

      const ticket = await db.getTicket(ticket_id);
      if (!ticket || ticket.user_id !== user_id) return res.status(404).json({ error: 'ticket_not_found' });
      if (ticket.status === 'claimed') return res.status(400).json({ error: 'already_claimed' });

      await db.updateTicketStatus(ticket_id, 'claimed');
      let new_balance: number;
      if (ticket.win_amount_cdf > 0) {
        new_balance = await db.adjustBalance(user_id, ticket.win_amount_cdf);
      } else {
        const u = await db.getUser(user_id);
        new_balance = u?.balance_cdf ?? 0;
      }
      return res.json({
        win_amount_cdf: ticket.win_amount_cdf,
        new_balance,
        grid: ticket.grid,
      });
    } catch (e: any) {
      console.error('[scratch/claim]', e);
      return res.status(500).json({ error: e.message ?? 'server_error' });
    }
  });

  return r;
}
