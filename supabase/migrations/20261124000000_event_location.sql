-- Aylık Plan etkinliklerine isteğe bağlı mekan
alter table public.events add column location text not null default '';
