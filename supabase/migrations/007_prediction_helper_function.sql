-- Create helper function to check if predictions are allowed for a match
CREATE OR REPLACE FUNCTION predictions_allowed_for_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_kickoff TIMESTAMP WITH TIME ZONE;
  v_match_status match_status;
BEGIN
  SELECT kickoff_time, status 
  INTO v_match_kickoff, v_match_status
  FROM matches 
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Predictions allowed if match is TIMED and more than 2 hours away
  RETURN (v_match_status = 'TIMED' AND v_match_kickoff > NOW() + INTERVAL '2 hours');
END;
$$;