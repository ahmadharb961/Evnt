import { describe, expect, it } from "vitest";
import { commissionFor, applyLeadCredit, restaurantFee, withinExternalWindow } from "@/lib/commission";
import { simulate, DEFAULT_SCENARIO } from "@/lib/revenue";
import { formatMoney, parseMoney } from "@/lib/money";
import { windowFor, beirutYmd } from "@/lib/dates";

describe("commission", () => {
  it("applies 100% / 50% / 0% attribution", () => {
    expect(commissionFor(10000, 1500, "EVNT").amountCents).toBe(1500);
    expect(commissionFor(10000, 1500, "EVNT_EXTERNAL").amountCents).toBe(750);
    expect(commissionFor(10000, 1500, "MERCHANT_LINK").amountCents).toBe(0);
  });
  it("charges restaurants per verified guest", () => {
    expect(restaurantFee(5, 200)).toBe(1000);
    expect(restaurantFee(5, 150)).toBe(750);
    expect(restaurantFee(5, 100)).toBe(500);
  });
  it("credits a lead fee once, never below zero", () => {
    expect(applyLeadCredit(1200, 2000)).toEqual({ creditCents: 1200, netCommissionCents: 0 });
    expect(applyLeadCredit(3000, 2000)).toEqual({ creditCents: 2000, netCommissionCents: 1000 });
  });
  it("72-hour window", () => {
    const c = new Date("2026-01-01T10:00:00Z");
    expect(withinExternalWindow(c, new Date("2026-01-04T09:59:00Z"))).toBe(true);
    expect(withinExternalWindow(c, new Date("2026-01-04T10:01:00Z"))).toBe(false);
    expect(withinExternalWindow(c, new Date("2025-12-31T10:00:00Z"))).toBe(false);
  });
});

describe("revenue simulator defaults", () => {
  it("matches the brief", () => {
    const r = simulate(DEFAULT_SCENARIO);
    expect(r.subscriptions).toBe(436000);
    expect(r.memberships).toBe(199800);
    expect(r.commissions).toBe(240000);
    expect(r.assessments).toBe(125000);
    expect(r.gross).toBe(1000800);
  });
});

describe("money & dates", () => {
  it("formats and parses", () => {
    expect(formatMoney(2500)).toBe("$25");
    expect(formatMoney(2550)).toBe("$25.50");
    expect(parseMoney("$12.5")).toBe(1250);
    expect(parseMoney("abc")).toBeNull();
  });
  it("weekend window lands on Saturday", () => {
    const w = windowFor("weekend", new Date("2026-11-11T10:00:00Z"))!; // a Wednesday
    expect(beirutYmd(w.from).weekday).toBe(6);
  });
});
