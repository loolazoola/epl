-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can insert their own profile (for first-time registration)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Allow reading all users for leaderboard (but limit sensitive data in application layer)
CREATE POLICY "Users can view leaderboard data" ON users
  FOR SELECT USING (true);

-- Matches table policies
-- Everyone can read matches (they are public data)
CREATE POLICY "Anyone can view matches" ON matches
  FOR SELECT USING (true);

-- Only authenticated users can read matches (alternative approach)
-- CREATE POLICY "Authenticated users can view matches" ON matches
--   FOR SELECT USING (auth.role() = 'authenticated');

-- Predictions table policies
-- Users can only see their own predictions
CREATE POLICY "Users can view own predictions" ON predictions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can insert their own predictions
CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own predictions (application logic will handle timing constraints)
CREATE POLICY "Users can update own predictions" ON predictions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own predictions (application logic will handle timing constraints)
CREATE POLICY "Users can delete own predictions" ON predictions
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create a function to check if user can modify prediction based on match timing
CREATE OR REPLACE FUNCTION can_modify_prediction(match_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  match_kickoff TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT kickoff_time INTO match_kickoff
  FROM matches
  WHERE id = match_uuid;
  
  -- Allow modification if match hasn't started yet (5 minute buffer)
  RETURN (match_kickoff > NOW() + INTERVAL '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced prediction policies with timing constraints
DROP POLICY IF EXISTS "Users can update own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can delete own predictions" ON predictions;

CREATE POLICY "Users can update own predictions before match" ON predictions
  FOR UPDATE USING (
    auth.uid()::text = user_id::text AND 
    can_modify_prediction(match_id)
  );

CREATE POLICY "Users can delete own predictions before match" ON predictions
  FOR DELETE USING (
    auth.uid()::text = user_id::text AND 
    can_modify_prediction(match_id)
  );