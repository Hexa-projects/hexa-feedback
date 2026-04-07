
SELECT cron.schedule(
  'sync-openclaw-worker',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/sync-openclaw-events',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4"}'::jsonb,
    body:='{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
