-- Invoke the care-reminder worker every minute. The project must have Vault
-- secrets named project_url and service_role_key before this schedule is used.
-- This keeps credentials out of migrations and client bundles.

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
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);
