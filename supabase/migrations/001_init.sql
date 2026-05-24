-- Congo Gaming — Scratch Card migration
-- Safe to run in an existing project; only creates objects if missing.

create extension if not exists pgcrypto;

-- Users table is assumed to exist in the main app.
-- Minimal compatible definition (only created if missing) so this migration
-- can run standalone.
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique,
  balance_cdf integer not null default 0,
  created_at  timestamptz default now()
);

-- Balance adjustment RPC (idempotent install).
create or replace function public.adjust_balance(p_user_id uuid, p_delta integer)
returns integer
language plpgsql
as $$
declare
  v_new integer;
begin
  update public.users
     set balance_cdf = balance_cdf + p_delta
   where id = p_user_id
  returning balance_cdf into v_new;

  if v_new is null then
    raise exception 'user % not found', p_user_id;
  end if;
  if v_new < 0 then
    raise exception 'insufficient_balance';
  end if;
  return v_new;
end;
$$;

-- Scratch tickets
create table if not exists public.scratch_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete cascade,
  bet_amount_cdf  integer not null,
  grid            jsonb   not null,
  win_amount_cdf  integer not null default 0,
  status          text default 'pending' check (status in ('pending','revealed','claimed')),
  created_at      timestamptz default now()
);

create index if not exists scratch_tickets_user_created_idx
  on public.scratch_tickets(user_id, created_at desc);
