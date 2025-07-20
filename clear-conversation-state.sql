-- Query to clear all data from the conversation_state table
DELETE FROM conversation_state;

-- If you want to also reset any sequences/auto-increment values (PostgreSQL specific)
-- This is optional and depends on your database setup
-- ALTER SEQUENCE conversation_state_id_seq RESTART WITH 1;