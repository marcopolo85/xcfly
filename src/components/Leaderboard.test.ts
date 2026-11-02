import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })) };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import { submitFlight } from "./Leaderboard";

describe("XC leaderboard submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
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
});