import { afterEach, expect, it, vi } from "vitest";
import { saveTile, tileResponse } from "./offline-data";
import { OFFLINE_KEY } from "./offline-policy";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it("reads device data without internet or a network request", async () => {
  localStorage.setItem(OFFLINE_KEY, "true");
  const saved = { ok: true, blob: async () => new Blob(["real tile"]) };
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", { open: async () => ({ match: async () => saved }) });
  expect(await tileResponse("https://thermal.kk7.ch/tile.png")).toBe(saved);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not store unsuccessful responses as valid flight data", async () => {
  const put = vi.fn();
  vi.stubGlobal("caches", { open: async () => ({ match: async () => undefined, put }) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  await expect(saveTile("https://thermal.kk7.ch/missing.png")).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
});