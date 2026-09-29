-- Günce: ilk şema

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  timezone text not null default 'Europe/Istanbul',
  default_time time not null default '09:00',
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default 'blue',
  icon text not null default 'list',
  position double precision not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- steps:     [{ "id": uuid, "title": text, "done": bool }]
-- reminders: [{ "id": uuid, "type": "offset", "minutes": int } | { "id": uuid, "type": "absolute", "at": "YYYY-MM-DDTHH:mm" }]
-- recurrence: { "freq": "daily"|"weekly"|"monthly"|"yearly", "interval": int, "byWeekday"?: int[], "until"?: "YYYY-MM-DD" }
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  list_id uuid not null references public.lists on delete cascade,
  kind text not null default 'task' check (kind in ('task', 'reminder')),
  title text not null,
  note text not null default '',
  due_date date,
  due_time time,
  time_explicit boolean not null default false,
  important boolean not null default false,
  my_day date,
  recurrence jsonb,
  steps jsonb not null default '[]',
  reminders jsonb not null default '[]',
  completed_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index items_user_updated on public.items (user_id, updated_at);
create index items_due on public.items (due_date) where deleted_at is null and completed_at is null;
create index lists_user_updated on public.lists (user_id, updated_at);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.notification_log (
  item_id uuid not null references public.items on delete cascade,
  fire_key text not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, fire_key)
);

-- updated_at her yazmada sunucu saatine çekilir; senkron imleci buna dayanır
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger lists_touch before insert or update on public.lists
  for each row execute function public.touch_updated_at();
create trigger items_touch before insert or update on public.items
  for each row execute function public.touch_updated_at();
create trigger settings_touch before insert or update on public.settings
  for each row execute function public.touch_updated_at();

-- Satır düzeyi güvenlik: herkes yalnızca kendi verisini görür
alter table public.settings enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy own_settings on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_lists on public.lists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_items on public.items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_subs on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- notification_log yalnızca service role (dispatch fonksiyonu) tarafından kullanılır

alter publication supabase_realtime add table public.lists, public.items, public.settings;

create extension if not exists pg_cron;
create extension if not exists pg_net;
