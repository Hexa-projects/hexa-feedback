SELECT cron.schedule(
  'openclaw-sync-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/openclaw-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4"}'::jsonb,
    body := '{"action":"process_queue"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'openclaw-auto-analysis-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/openclaw-auto-analysis',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'openclaw-queue-stats-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/openclaw-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4"}'::jsonb,
    body := '{"action":"queue_stats"}'::jsonb
  ) AS request_id;
  $$
);