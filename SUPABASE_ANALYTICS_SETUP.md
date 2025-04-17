# Setting Up Supabase Analytics System

This guide explains how to set up the enhanced analytics tracking system in Supabase.

## Step 1: Create the Analytics Table

Navigate to your Supabase project, go to the SQL Editor, and run the following SQL script:

```sql
-- Contents of sql/analytics_table.sql

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
```

## Step 2: Create SQL Functions for Data Aggregation

Run the following SQL script to create the necessary functions for data aggregation:

```sql
-- Contents of sql/analytics_functions.sql

-- Function to get top searches from the analytics_events table
CREATE OR REPLACE FUNCTION get_top_searches(limit_count INTEGER)
RETURNS TABLE (
  query TEXT,
  search_type TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_data->>'query' AS query,
    event_data->>'search_type' AS search_type,
    COUNT(*) AS count
  FROM 
    analytics_events
  WHERE 
    event_type = 'search'
  GROUP BY 
    event_data->>'query', event_data->>'search_type'
  ORDER BY 
    count DESC
  LIMIT limit_count;
END;
$$;

-- Function to get top clicked groups from the analytics_events table
CREATE OR REPLACE FUNCTION get_top_groups(limit_count INTEGER)
RETURNS TABLE (
  group_id TEXT,
  university TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_data->>'group_id' AS group_id,
    event_data->>'university' AS university,
    event_data->>'city' AS city,
    event_data->>'state' AS state,
    event_data->>'country' AS country,
    COUNT(*) AS count
  FROM 
    analytics_events
  WHERE 
    event_type = 'group_click'
  GROUP BY 
    event_data->>'group_id', 
    event_data->>'university', 
    event_data->>'city', 
    event_data->>'state', 
    event_data->>'country'
  ORDER BY 
    count DESC
  LIMIT limit_count;
END;
$$;

-- Function to get analytics by date
CREATE OR REPLACE FUNCTION get_analytics_by_date(start_date TIMESTAMP, end_date TIMESTAMP)
RETURNS TABLE (
  date DATE,
  event_type TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) AS date,
    event_type,
    COUNT(*) AS count
  FROM 
    analytics_events
  WHERE 
    created_at BETWEEN start_date AND end_date
  GROUP BY 
    DATE(created_at), event_type
  ORDER BY 
    date ASC;
END;
$$;

-- Function to get analytics by hour of day
CREATE OR REPLACE FUNCTION get_analytics_by_hour()
RETURNS TABLE (
  hour INTEGER,
  event_type TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
    event_type,
    COUNT(*) AS count
  FROM 
    analytics_events
  GROUP BY 
    EXTRACT(HOUR FROM created_at)::INTEGER, event_type
  ORDER BY 
    hour ASC;
END;
$$;

-- Function to get button click analytics
CREATE OR REPLACE FUNCTION get_button_clicks()
RETURNS TABLE (
  button_type TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_data->>'button_type' AS button_type,
    COUNT(*) AS count
  FROM 
    analytics_events
  WHERE 
    event_type = 'button_click'
  GROUP BY 
    event_data->>'button_type'
  ORDER BY 
    count DESC;
END;
$$;

-- Function to get location usage analytics
CREATE OR REPLACE FUNCTION get_location_usage()
RETURNS TABLE (
  action_type TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_data->>'action_type' AS action_type,
    COUNT(*) AS count
  FROM 
    analytics_events
  WHERE 
    event_type = 'location_use'
  GROUP BY 
    event_data->>'action_type'
  ORDER BY 
    count DESC;
END;
$$;
```

## Step 3: Install Dependencies for the Analytics Dashboard

Run the following command to install Recharts for the dashboard visualizations:

```bash
npm install recharts
```

## Step 4: Access the Analytics Dashboard

After deploying your application, navigate to:

```
/admin/analytics
```

You'll need to be logged in as an admin to access this page.

## Features of the Enhanced Analytics System

1. **Comprehensive Event Tracking**:
   - Search queries with search type and result count
   - Group clicks from both map and search results
   - Suggestion selections from dropdown
   - Button clicks (Instagram, Maps, etc.)
   - Location usage

2. **Detailed Context Information**:
   - Session tracking across visits
   - User agent information
   - Referrer data
   - URL data

3. **Analytics Dashboard Features**:
   - Real-time data visualization
   - Top searches report
   - Most viewed groups report
   - Filtering by date range and event type
   - Raw data export to CSV

4. **Privacy Considerations**:
   - No personally identifiable information is collected
   - Location data is rounded for privacy
   - Row-level security in Supabase ensures data protection

## How It Works

The system consists of three main components:

1. **Client-Side Tracking**:
   - `src/lib/supabase-analytics.ts` contains utility functions for tracking events
   - Events are captured at user interaction points throughout the application

2. **Supabase Database**:
   - Events are stored in the `analytics_events` table
   - SQL functions provide efficient data aggregation

3. **Admin Dashboard**:
   - Visualizes the collected data
   - Provides filtering and export capabilities

## Extending the System

To track additional events:

1. Add a new tracking function to `src/lib/supabase-analytics.ts`
2. Implement the tracking at the appropriate interaction point
3. Update the dashboard to display the new data

## Troubleshooting

If you encounter issues:

1. Check the browser console for errors during event tracking
2. Ensure Supabase RLS policies are correctly configured
3. Verify that all SQL functions are properly created
4. Check that the admin user has the correct permissions 