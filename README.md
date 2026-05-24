# Congo Gaming — Scratch Card

Mobile-first scratch card game (React + Vite + Express + Supabase).

## Stack
- Frontend: React 18, Vite, React Router, HTML5 Canvas scratch, canvas-confetti.
- Backend: Express + TypeScript (`tsx`), Supabase (service role) with a built-in mock DB fallback for local dev.
- DB: Postgres / Supabase, see `supabase/migrations/001_init.sql`.

## Quick start
```bash
npm install
cp .env.example .env   # edit if you have Supabase, otherwise keep USE_MOCK_DB=true
npm run dev
```
- Web: http://localhost:5173
- API: http://localhost:8787

## Game rules
- Bet: 500 / 1000 / 2000 / 5000 CDF.
- 3×3 grid of symbols: `okapi`, `diamond`, `lightning`, `star`, `coin`, `flame`.
- Win conditions:
  - 3 identical in a row / column / diagonal:
    - okapi×3 → bet × 50 (jackpot)
    - diamond×3 → × 20
    - lightning×3 → × 10
    - star×3 → × 5
    - coin×3 → × 3
    - flame×3 → × 2
  - Any 2 identical anywhere → bet × 0.5 (consolation)
  - Otherwise → 0
- Target house edge ≈ 35%.

## API
- `POST /api/scratch/buy` `{ user_id, bet_amount_cdf }` → `{ ticket_id, grid_hidden, bet_amount_cdf, win_amount_cdf }` (win hidden until claimed).
- `POST /api/scratch/claim` `{ ticket_id, user_id }` → `{ win_amount_cdf, new_balance, grid }`.
- `GET /api/admin/scratch/tickets?page=1&page_size=20` (admin).
- `GET /api/admin/scratch/overview` → `{ scratch_revenue_today }`.
- `GET /api/me?user_id=...` → `{ balance }` (helper).

## Frontend routes
- `/` Home (promo cards including Scratch).
- `/scratch` Scratch Card game.
- `/admin` Admin GamesTab (Scratch sub-tab).

## Repo
Pushes to: https://github.com/zefparis/scratch.git
