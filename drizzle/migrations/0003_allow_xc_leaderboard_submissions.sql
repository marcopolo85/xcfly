ALTER POLICY "Jeder darf Flüge eintragen"
ON public.leaderboard_entries
TO anon, authenticated
WITH CHECK (
  char_length(pilot_name) >= 1 AND char_length(pilot_name) <= 40
  AND char_length(site_name) >= 1 AND char_length(site_name) <= 80
  AND mode = ANY (ARRAY['out_return'::text, 'one_way'::text, 'free'::text, 'xc'::text])
  AND distance_km >= 0 AND distance_km < 2000
  AND duration_s >= 0 AND duration_s < 86400
);