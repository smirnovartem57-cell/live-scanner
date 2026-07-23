-- Restore the server-only permission required by the social-data Edge Function.
-- Migration 002 intentionally revokes public execution, including privileges
-- inherited through PUBLIC, so service_role must be granted explicitly.

grant execute on function public.increment_feedback_votes(text) to service_role;
grant select, insert, update on table public.app_profiles to service_role;
grant select, insert, update on table public.feedback_items to service_role;
