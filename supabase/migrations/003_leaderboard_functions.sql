-- Create function to get leaderboard with user statistics
CREATE OR REPLACE FUNCTION get_leaderboard_with_stats(
  page_limit INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  name VARCHAR,
  avatar_url TEXT,
  total_points INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  correct_predictions BIGINT,
  total_predictions BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.avatar_url,
    u.total_points,
    u.created_at,
    u.updated_at,
    COALESCE(stats.correct_predictions, 0) as correct_predictions,
    COALESCE(stats.total_predictions, 0) as total_predictions
  FROM users u
  LEFT JOIN (
    SELECT 
      p.user_id,
      COUNT(*) as total_predictions,
      COUNT(CASE WHEN p.points_earned > 0 THEN 1 END) as correct_predictions
    FROM predictions p
    WHERE p.processed = true
    GROUP BY p.user_id
  ) stats ON u.id = stats.user_id
  ORDER BY 
    u.total_points DESC,
    u.updated_at ASC  -- Tie-breaker: earlier registration wins
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Create function to get user rank efficiently
CREATE OR REPLACE FUNCTION get_user_rank(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_points INTEGER;
  user_updated_at TIMESTAMPTZ;
  user_rank INTEGER;
BEGIN
  -- Get user's points and updated_at
  SELECT total_points, updated_at 
  INTO user_points, user_updated_at
  FROM users 
  WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate rank
  SELECT COUNT(*) + 1 INTO user_rank
  FROM users
  WHERE total_points > user_points
     OR (total_points = user_points AND updated_at < user_updated_at);
  
  RETURN user_rank;
END;
$$;