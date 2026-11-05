import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from, query } = vi.hoisted(() => {
  const insert = vi.fn();
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), range: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [], error: null });
  return { insert, query, from: vi.fn(() => ({ insert, ...query })) };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import { fmtStamp, loadLeaderboardEntries, submitFlight } from "./Leaderboard";

describe("flight timestamp", () => {
  const p = (n: number) => String(n).padStart(2, "0");

  it("formats an entry as local day.month.year and 24-hour clock", () => {
    const iso = "2026-11-05T20:39:00.000Z";
    const d = new Date(iso);
    expect(fmtStamp(iso)).toEqual({
      date: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${p(d.getFullYear() % 100)}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}`,
    });
  });

  it("shows a dash instead of an unusable timestamp", () => {
    expect(fmtStamp("not-a-date")).toEqual({ date: "–", time: "" });
  });
});

describe("XC leaderboard submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    query.range.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("saves XC mode, route points and the track in the shared leaderboard", async () => {
    const track: [number, number][] = [[46.902806, 8.365261], [46.91, 8.37]];
    expect(await submitFlight(" TiM ", "Gummen", 81.1, 97.4, "tri", 11316, track)).toBeNull();
    expect(from).toHaveBeenCalledWith("leaderboard_entries");
    expect(insert).toHaveBeenCalledWith({
      pilot_name: "TiM", site_name: "Gummen", mode: "xc",
      distance_km: 81.1, points: 97.4, route_type: "tri",
      duration_s: 11316, track,
    });
  });

  it("does not report success when the cloud rejects an entry", async () => {
    insert.mockResolvedValue({ error: { message: "Permission denied" } });
    expect(await submitFlight("TiM", "Gummen", 81.1, 97.4, "tri", 11316, [])).toBe("Permission denied");
  });

  it("loads overall XC flights across all sites in descending points order", async () => {
    await loadLeaderboardEntries();
    expect(query.eq.mock.calls).toEqual([["mode", "xc"]]);
    expect(query.order).toHaveBeenCalledWith("points", { ascending: false });
  });

  it("keeps the individual launch-site ranking restricted to that site", async () => {
    await loadLeaderboardEntries("Gummen");
    expect(query.eq.mock.calls).toEqual([["mode", "xc"], ["site_name", "Gummen"]]);
  });

  it("includes every overall flight beyond both the old 50-flight limit and a full result page", async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) => ({ id: `flight-${i}`, site_name: i % 2 ? "Gummen" : "Mornera" }));
    const lastFlight = { id: "flight-500", site_name: "Niesen" };
    query.range.mockResolvedValueOnce({ data: firstPage, error: null }).mockResolvedValueOnce({ data: [lastFlight], error: null });
    const result = await loadLeaderboardEntries();
    expect(result.data).toEqual([...firstPage, lastFlight]);
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(query.limit).not.toHaveBeenCalled();
  });
});