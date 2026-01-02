-- Create atomic prediction submission function
-- This function handles prediction creation with proper validation and error handling

CREATE OR REPLACE FUNCTION create_prediction_atomic(
  p_user_id UUID,
  p_match_id UUID,
  p_predicted_home_score INTEGER,
  p_predicted_away_score INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  prediction_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_kickoff TIMESTAMP WITH TIME ZONE;
  v_match_status match_status;
  v_existing_prediction_id UUID;
  v_new_prediction_id UUID;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL OR p_match_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'User ID and Match ID are required';
    RETURN;
  END IF;

  IF p_predicted_home_score < 0 OR p_predicted_away_score < 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Predicted scores cannot be negative';
    RETURN;
  END IF;

  IF p_predicted_home_score > 20 OR p_predicted_away_score > 20 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Predicted scores cannot exceed 20';
    RETURN;
  END IF;

  -- Check if match exists and get its details
  SELECT kickoff_time, status 
  INTO v_match_kickoff, v_match_status
  FROM matches 
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Match not found';
    RETURN;
  END IF;

  -- Check if match has already started or finished
  IF v_match_status != 'TIMED' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Match has already started or finished';
    RETURN;
  END IF;

  -- Check if match is within 2 hours of kickoff (prediction lock period)
  IF v_match_kickoff <= NOW() + INTERVAL '2 hours' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Predictions are locked within 2 hours of kickoff';
    RETURN;
  END IF;

  -- Check if user already has a prediction for this match
  SELECT id INTO v_existing_prediction_id
  FROM predictions
  WHERE user_id = p_user_id AND match_id = p_match_id;

  IF FOUND THEN
    -- Update existing prediction
    UPDATE predictions
    SET 
      predicted_home_score = p_predicted_home_score,
      predicted_away_score = p_predicted_away_score,
      updated_at = NOW()
    WHERE id = v_existing_prediction_id;

    RETURN QUERY SELECT true, v_existing_prediction_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Create new prediction
  INSERT INTO predictions (
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    points_earned,
    processed,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_match_id,
    p_predicted_home_score,
    p_predicted_away_score,
    0,
    false,
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_prediction_id;

  RETURN QUERY SELECT true, v_new_prediction_id, NULL::TEXT;

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where another process created a prediction
    RETURN QUERY SELECT false, NULL::UUID, 'A prediction for this match already exists';
  WHEN foreign_key_violation THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid user or match reference';
  WHEN check_violation THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid prediction values';
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Unexpected error in create_prediction_atomic: %', SQLERRM;
    RETURN QUERY SELECT false, NULL::UUID, 'An unexpected error occurred';
END;
$$;