import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Tiny abstraction: real Supabase when env vars are set, else a mock in-memory
 * store so the app is runnable end-to-end during local development.
 */

type User = { id: string; phone: string; balance_cdf: number; created_at: string };
type Ticket = {
  id: string;
  user_id: string;
  bet_amount_cdf: number;
  grid: string[];
  win_amount_cdf: number;
  status: 'pending' | 'revealed' | 'claimed';
  created_at: string;
};

export interface Db {
  getUser(user_id: string): Promise<User | null>;
  ensureDemoUser(user_id: string): Promise<User>;
  adjustBalance(user_id: string, delta: number): Promise<number>;
  insertTicket(t: Omit<Ticket, 'id' | 'created_at'>): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket | null>;
  updateTicketStatus(id: string, status: Ticket['status']): Promise<void>;
  listTickets(page: number, pageSize: number): Promise<{ rows: (Ticket & { phone: string | null })[]; total: number }>;
  scratchRevenueToday(): Promise<number>;
}

// ---------------- Mock DB ----------------
class MockDb implements Db {
  private users = new Map<string, User>();
  private tickets: Ticket[] = [];

  async getUser(id: string) {
    return this.users.get(id) ?? null;
  }
  async ensureDemoUser(id: string) {
    let u = this.users.get(id);
    if (!u) {
      u = { id, phone: '+243' + id.slice(0, 9), balance_cdf: 100_000, created_at: new Date().toISOString() };
      this.users.set(id, u);
    }
    return u;
  }
  async adjustBalance(id: string, delta: number) {
    const u = await this.ensureDemoUser(id);
    const next = u.balance_cdf + delta;
    if (next < 0) throw new Error('insufficient_balance');
    u.balance_cdf = next;
    return next;
  }
  async insertTicket(t: Omit<Ticket, 'id' | 'created_at'>) {
    const row: Ticket = { ...t, id: randomUUID(), created_at: new Date().toISOString() };
    this.tickets.unshift(row);
    return row;
  }
  async getTicket(id: string) {
    return this.tickets.find((x) => x.id === id) ?? null;
  }
  async updateTicketStatus(id: string, status: Ticket['status']) {
    const t = this.tickets.find((x) => x.id === id);
    if (t) t.status = status;
  }
  async listTickets(page: number, pageSize: number) {
    const start = (page - 1) * pageSize;
    const slice = this.tickets.slice(start, start + pageSize).map((t) => ({
      ...t,
      phone: this.users.get(t.user_id)?.phone ?? null,
    }));
    return { rows: slice, total: this.tickets.length };
  }
  async scratchRevenueToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rev = 0;
    for (const t of this.tickets) {
      if (new Date(t.created_at) >= today) rev += t.bet_amount_cdf - t.win_amount_cdf;
    }
    return rev;
  }
}

// ---------------- Supabase DB ----------------
class SupaDb implements Db {
  constructor(private sb: SupabaseClient) {}

  async getUser(id: string) {
    const { data } = await this.sb.from('users').select('*').eq('id', id).maybeSingle();
    return (data as User) ?? null;
  }
  async ensureDemoUser(id: string) {
    const existing = await this.getUser(id);
    if (existing) return existing;
    const { data, error } = await this.sb
      .from('users')
      .insert({ id, phone: '+243' + id.slice(0, 9), balance_cdf: 100_000 })
      .select('*')
      .single();
    if (error) throw error;
    return data as User;
  }
  async adjustBalance(id: string, delta: number) {
    const { data, error } = await this.sb.rpc('adjust_balance', { p_user_id: id, p_delta: delta });
    if (error) throw error;
    return data as number;
  }
  async insertTicket(t: Omit<Ticket, 'id' | 'created_at'>) {
    const { data, error } = await this.sb.from('scratch_tickets').insert(t).select('*').single();
    if (error) throw error;
    return data as Ticket;
  }
  async getTicket(id: string) {
    const { data } = await this.sb.from('scratch_tickets').select('*').eq('id', id).maybeSingle();
    return (data as Ticket) ?? null;
  }
  async updateTicketStatus(id: string, status: Ticket['status']) {
    const { error } = await this.sb.from('scratch_tickets').update({ status }).eq('id', id);
    if (error) throw error;
  }
  async listTickets(page: number, pageSize: number) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await this.sb
      .from('scratch_tickets')
      .select('*, users(phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => ({ ...r, phone: r.users?.phone ?? null }));
    return { rows, total: count ?? rows.length };
  }
  async scratchRevenueToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await this.sb
      .from('scratch_tickets')
      .select('bet_amount_cdf, win_amount_cdf, created_at')
      .gte('created_at', today.toISOString());
    if (error) throw error;
    return (data ?? []).reduce((acc: number, r: any) => acc + (r.bet_amount_cdf - r.win_amount_cdf), 0);
  }
}

export function makeDb(): Db {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const forceMock = process.env.USE_MOCK_DB === 'true';
  if (!forceMock && url && key && !url.includes('YOUR-PROJECT')) {
    // eslint-disable-next-line no-console
    console.log('[db] using Supabase at', url);
    return new SupaDb(createClient(url, key, { auth: { persistSession: false } }));
  }
  console.log('[db] using in-memory MOCK store (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable Supabase)');
  return new MockDb();
}
