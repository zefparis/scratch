// Lightweight API client.
// A persistent demo user id is generated and kept in localStorage so the
// balance survives reloads (server creates the user lazily on first call).

const KEY = 'cg.user_id';

function uuidv4(): string {
  // RFC4122-ish, sufficient for demo.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getUserId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function jpost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => jget<{ user_id: string; phone: string; balance: number }>(`/api/me?user_id=${getUserId()}`),
  buy: (bet_amount_cdf: number) =>
    jpost<{ ticket_id: string; grid_hidden: true; bet_amount_cdf: number; grid: string[] }>(
      '/api/scratch/buy',
      { user_id: getUserId(), bet_amount_cdf }
    ),
  claim: (ticket_id: string) =>
    jpost<{ win_amount_cdf: number; new_balance: number; grid: string[] }>(
      '/api/scratch/claim',
      { user_id: getUserId(), ticket_id }
    ),
  adminTickets: (page = 1) =>
    jget<{
      page: number; page_size: number; total: number;
      rows: Array<{ id: string; created_at: string; phone: string | null; bet_amount_cdf: number; win_amount_cdf: number; status: string }>;
    }>(`/api/admin/scratch/tickets?page=${page}&page_size=20`),
  adminOverview: () => jget<{ scratch_revenue_today: number }>('/api/admin/scratch/overview'),
};
