-- PostgreSQL does not support removing a value from an existing enum type.
-- Rolling back requires recreating the type without 'openrouter', which is
-- only safe when no row references the value. This down migration is a
-- deliberate no-op; treat the enum addition as forward-only.
SELECT 1;
