-- Dakikada bir dispatch fonksiyonunu çağırır.
-- Proje adresi ve paylaşılan gizli anahtar Vault'ta tutulur (repoya girmez):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<rastgele-anahtar>', 'cron_secret');

select cron.schedule(
  'gunce-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);

-- Günlük temizlik: eski cron kayıtları ve bildirim günlüğü
select cron.schedule(
  'gunce-cleanup',
  '17 3 * * *',
  $$
  delete from cron.job_run_details where end_time < now() - interval '2 days';
  delete from public.notification_log where sent_at < now() - interval '60 days';
  delete from public.items where deleted_at < now() - interval '30 days';
  delete from public.lists where deleted_at < now() - interval '30 days';
  $$
);
