import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlightHUD, type HudData } from "./FlightHUD";
import { XC_TIME_LIMIT_S } from "@/game/modes";

const base: HudData = {
  alt: 2000, agl: 1500, vz: 1, speed: 10.5, time: 0, xc: 0, xcSpeed: 0,
  tri: 0, triFai: false, triMin: 0, triMax: 0, close: 0, clock: "11:00",
  accel: false, cloudbase: 3000,
};

describe("FlightHUD rest time", () => {
  it("counts down the 4 h XC flight time", () => {
    expect(XC_TIME_LIMIT_S).toBe(4 * 3600);
    render(<FlightHUD d={{ ...base, remain: XC_TIME_LIMIT_S }} />);
    expect(screen.getByText("RESTZEIT")).toBeInTheDocument();
    expect(screen.getByText("4:00:00")).toBeInTheDocument();
  });
  it("scales the AGL bar from ground to cloudbase", () => {
    render(<FlightHUD d={base} />);
    // ground 500 m, cloudbase 3000 m → 2500 m AGL range
    expect(screen.getByRole("meter", { name: "Höhe über Grund" })).toHaveAttribute("aria-valuemax", "2500");
  });
  it("shows no countdown in free flight", () => {
    render(<FlightHUD d={base} />);
    expect(screen.queryByText("RESTZEIT")).not.toBeInTheDocument();
  });
});
