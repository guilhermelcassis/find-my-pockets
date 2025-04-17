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