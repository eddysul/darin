-- Invoke the care-reminder worker every minute. Apply this migration only after
-- manual worker and real-device QA. Vault must contain project_url and the
-- dedicated care_reminder_cron_secret. The service-role key stays in the Edge
-- Function environment and is never sent in an HTTP request.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-care-reminders-every-minute') then
    perform cron.unschedule('process-care-reminders-every-minute');
  end if;
end;
$$;

select cron.schedule(
  'process-care-reminders-every-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/process-care-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'care_reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);
