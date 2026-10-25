CREATE TABLE public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  duration_s INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.leaderboard_entries TO anon;
GRANT SELECT, INSERT ON public.leaderboard_entries TO authenticated;
GRANT ALL ON public.leaderboard_entries TO service_role;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rangliste ist öffentlich lesbar" ON public.leaderboard_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Jeder darf Flüge eintragen" ON public.leaderboard_entries FOR INSERT TO anon, authenticated WITH CHECK (char_length(pilot_name) BETWEEN 1 AND 40 AND char_length(site_name) BETWEEN 1 AND 80 AND mode IN ('out_return','one_way','free') AND distance_km >= 0 AND distance_km < 2000 AND duration_s >= 0 AND duration_s < 86400);