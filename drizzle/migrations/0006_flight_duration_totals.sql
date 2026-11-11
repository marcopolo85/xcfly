ALTER TABLE public.flight_stats ADD COLUMN duration_s integer;
ALTER TABLE public.flight_stats ADD CONSTRAINT flight_stats_duration_nonnegative CHECK (duration_s >= 0);
COMMENT ON COLUMN public.flight_stats.duration_s IS 'Simulated flight duration in seconds; NULL for historical flights whose duration was not recorded.';
CREATE OR REPLACE FUNCTION public.flight_summary_with_hours()
RETURNS TABLE(flights_total bigint, flights_unranked bigint, pilots bigint, flight_hours numeric)
LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT s.flights_total, s.flights_unranked, s.pilots,
    ((SELECT COALESCE(SUM(duration_s), 0) FROM public.leaderboard_entries) +
     (SELECT COALESCE(SUM(duration_s), 0) FROM public.flight_stats))::numeric / 3600
  FROM public.flight_summary() AS s
$function$;
REVOKE ALL ON FUNCTION public.flight_summary_with_hours() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flight_summary_with_hours() TO anon, authenticated, service_role;