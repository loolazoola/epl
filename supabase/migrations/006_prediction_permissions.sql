-- Grant execute permission to authenticated users for prediction functions
GRANT EXECUTE ON FUNCTION create_prediction_atomic(UUID, UUID, INTEGER, INTEGER) TO authenticated;