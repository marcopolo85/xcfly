DROP POLICY IF EXISTS "Anyone can log a finished flight" ON public.flight_stats;
CREATE POLICY "Anyone can log a valid finished flight" ON public.flight_stats
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(site_name) BETWEEN 1 AND 80
    AND mode = ANY (ARRAY['out_return','one_way','free','xc','weekly_task'])
    AND (duration_s IS NULL OR (duration_s >= 0 AND duration_s < 86400))
  );

DROP POLICY IF EXISTS "Anyone can read flight counts" ON public.flight_stats;
CREATE POLICY "Recently logged flights are readable" ON public.flight_stats
  FOR SELECT TO anon, authenticated
  USING (created_at > now() - interval '1 day');

CREATE OR REPLACE FUNCTION public.flight_summary()
 RETURNS TABLE(flights_total bigint, flights_unranked bigint, pilots bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select
    (select count(*) from public.leaderboard_entries) + (select count(*) from public.flight_stats),
    (select count(*) from public.flight_stats),
    (select count(distinct lower(btrim(pilot_name))) from public.leaderboard_entries)
$function$;

CREATE OR REPLACE FUNCTION public.flight_summary_with_hours()
 RETURNS TABLE(flights_total bigint, flights_unranked bigint, pilots bigint, flight_hours numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT s.flights_total, s.flights_unranked, s.pilots,
    ((SELECT COALESCE(SUM(duration_s), 0) FROM public.leaderboard_entries) +
     (SELECT COALESCE(SUM(duration_s), 0) FROM public.flight_stats))::numeric / 3600
  FROM public.flight_summary() AS s
$function$;