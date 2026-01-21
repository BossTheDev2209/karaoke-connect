-- Create a simple function to return the current server time
-- This is used for client time synchronization

CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_time() TO anon;
