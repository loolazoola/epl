-- Create function for atomic user point increments
-- This prevents race conditions when multiple processes update user points simultaneously

CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET total_points = total_points + points_to_add,
      updated_at = NOW()
  WHERE id = user_id;
  
  -- Ensure the user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get processing statistics
CREATE OR REPLACE FUNCTION get_processing_stats()
RETURNS TABLE (
  total_matches BIGINT,
  finished_matches BIGINT,
  processed_predictions BIGINT,
  unprocessed_predictions BIGINT,
  total_points_awarded BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM matches) as total_matches,
    (SELECT COUNT(*) FROM matches WHERE status = 'FINISHED') as finished_matches,
    (SELECT COUNT(*) FROM predictions WHERE processed = true) as processed_predictions,
    (SELECT COUNT(*) FROM predictions WHERE processed = false) as unprocessed_predictions,
    (SELECT COALESCE(SUM(points_earned), 0) FROM predictions WHERE processed = true) as total_points_awarded;
END;
$$ LANGUAGE plpgsql;

-- Create index for better performance on unprocessed predictions
CREATE INDEX IF NOT EXISTS idx_predictions_match_unprocessed 
ON predictions(match_id, processed) 
WHERE processed = false;

-- Create index for better performance on finished matches
CREATE INDEX IF NOT EXISTS idx_matches_finished_status 
ON matches(status, kickoff_time) 
WHERE status = 'FINISHED';