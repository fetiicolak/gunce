-- Harcama Planı ve Aylık Plan

-- Bu ay yapılacak kesin harcamalar. "Her ay tekrarla" seçili satırdan sonraki aylar için
-- aynı series_id ile yeni satırlar üretilir (kimlik seri + ay'dan türetilir, cihazlar aynı satırı üretir).
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  series_id uuid not null,
  title text not null,
  amount numeric(12, 2) not null default 0,
  due_date date not null,
  recurring boolean not null default false,
  paid_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Aylık plan tablosundaki etkinlikler
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  title text not null,
  time time,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_user_updated on public.expenses (user_id, updated_at);
create index expenses_due on public.expenses (due_date) where deleted_at is null;
create index events_user_updated on public.events (user_id, updated_at);
create index events_date on public.events (date) where deleted_at is null;

create trigger expenses_touch before insert or update on public.expenses
  for each row execute function public.touch_updated_at();
create trigger events_touch before insert or update on public.events
  for each row execute function public.touch_updated_at();

alter table public.expenses enable row level security;
alter table public.events enable row level security;

create policy own_expenses on public.expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_events on public.events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.expenses, public.events;

-- Bildirim günlüğü artık harcama ve etkinlikler için de kullanılıyor (kimlik items tablosunda olmayabilir)
alter table public.notification_log drop constraint if exists notification_log_item_id_fkey;

-- Günlük temizliğe yeni tabloları ekle
select cron.unschedule('gunce-cleanup');
select cron.schedule(
  'gunce-cleanup',
  '17 3 * * *',
  $$
  delete from cron.job_run_details where end_time < now() - interval '2 days';
  delete from public.notification_log where sent_at < now() - interval '60 days';
  delete from public.items where deleted_at < now() - interval '30 days';
  delete from public.lists where deleted_at < now() - interval '30 days';
  delete from public.expenses where deleted_at < now() - interval '30 days';
  delete from public.events where deleted_at < now() - interval '30 days';
  $$
);
