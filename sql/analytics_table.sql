-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT NOT NULL,
  user_id UUID,
  user_agent TEXT,
  referrer TEXT,
  url TEXT,
  country TEXT,
  city TEXT
);

-- Create index on event_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);

-- Create index on created_at for faster date range queries
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);

-- Create index on session_id for session-based analytics
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id);

-- Create index on user_id for user-based analytics
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);

-- Create GIN index on event_data for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_analytics_event_data ON analytics_events USING GIN (event_data);

-- Add RLS (Row Level Security) policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting (allow anonymous inserts from clients)
CREATE POLICY "Allow anonymous inserts"
  ON analytics_events
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Create policy for select (only authenticated admins can view)
CREATE POLICY "Only admins can view"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Create a view for frequently accessed aggregated data
CREATE OR REPLACE VIEW analytics_summary AS
SELECT
  DATE(created_at) AS date,
  event_type,
  COUNT(*) AS event_count
FROM
  analytics_events
GROUP BY
  DATE(created_at),
  event_type
ORDER BY
  date DESC,
  event_count DESC; 