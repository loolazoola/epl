-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION predictions_allowed_for_match(UUID) TO authenticated;