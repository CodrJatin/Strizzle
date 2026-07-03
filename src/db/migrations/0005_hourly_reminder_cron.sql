-- 1. Add last_reminded_at column to tasks table if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

-- 2. Create the function
CREATE OR REPLACE FUNCTION check_upcoming_tasks() RETURNS VOID AS $$
DECLARE
  task_row RECORD;
  service_key TEXT;
  func_url TEXT;
BEGIN
  -- Get settings safely
  service_key := coalesce(current_setting('app.service_role_key', true), '');
  func_url := coalesce(current_setting('app.edge_function_url', true), 'http://localhost:54321/functions/v1');

  FOR task_row IN 
    SELECT id, assignee_id, title, due_at, hive_id
    FROM tasks
    WHERE due_at BETWEEN now() AND now() + interval '24 hours'
      AND status != 'done'
      AND assignee_id IS NOT NULL
      AND (last_reminded_at IS NULL OR last_reminded_at < now() - interval '12 hours')
  LOOP
    -- Invoke edge function via net.http_post
    PERFORM net.http_post(
      url := func_url || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )::TEXT,
      body := json_build_object(
        'userId', task_row.assignee_id,
        'title', 'Upcoming Task Reminder',
        'body', 'Reminder: "' || task_row.title || '" is due in less than 24 hours.',
        'url', '/desk',
        'hiveId', task_row.hive_id
      )::TEXT
    );

    -- Update last reminded timestamp
    UPDATE tasks
    SET last_reminded_at = now()
    WHERE id = task_row.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Register the schedule in pg_cron (if cron schema is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule check_upcoming_tasks to run every hour at minute 0
    PERFORM cron.schedule('hourly-task-reminders', '0 * * * *', 'SELECT check_upcoming_tasks()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Failed to register pg_cron schedule: %', SQLERRM;
END;
$$;
