import { describe, expect, it } from "vitest";
import { refuseOfflineWorker } from "./offline-policy";

describe("offline app preview safety", () => {
  it("does not register in development, framed previews or Lovable preview hosts", () => {
    expect(refuseOfflineWorker(false, "xcfly.lovable.app", false, "")).toBe(true);
    expect(refuseOfflineWorker(true, "xcfly.lovable.app", true, "")).toBe(true);
    for (const host of ["id-preview--283b0aaf.lovable.app", "preview-v2--shop.lovable.app", "project--283b0aaf-dev.lovable.app", "a.lovableproject.com", "beta.lovable.dev"]) expect(refuseOfflineWorker(true, host, false, "")).toBe(true);
  });
  it("allows the published app and custom domains, but respects sw=off", () => {
    expect(refuseOfflineWorker(true, "xcfly.lovable.app", false, "")).toBe(false);
    expect(refuseOfflineWorker(true, "preview-v2--shop.example.com", false, "")).toBe(false);
    expect(refuseOfflineWorker(true, "xcfly.lovable.app", false, "?sw=off")).toBe(true);
  });
});