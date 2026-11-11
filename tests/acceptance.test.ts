// Acceptance tests from the brief, against the real database (demo data loaded).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { startBooking, confirmWithoutOnlinePayment, scanTicket, cancelBooking, markPaidAtVenue } from "@/server/booking";
import { changePlan, markInvoicePaid } from "@/server/billing";
import { merchantFeatures } from "@/server/features";
import { createCampaign, reviewCampaign } from "@/server/ads";
import { applyForCertification, scheduleAssessment, submitAssessment, decideCertification, CHECKLIST } from "@/server/farah";
import { createReview } from "@/server/reviews";
import { recordBookingCommission } from "@/server/commission";
import { requestReservation, respondReservation, completeReservation } from "@/server/restaurants";
import { addDays, beirutYmd, beirutTime } from "@/lib/dates";

const stamp = Date.now();
let parent = "";
let admin = "";
const cleanup: (() => Promise<unknown>)[] = [];

async function freshMerchant(plan: "BASIC" | "PRO" | "FEATURED" = "BASIC") {
  const u = await prisma.user.create({ data: { email: `m${stamp}${Math.random()}@test.local`, name: "Test Owner" } });
  const m = await prisma.merchant.create({
    data: { slug: `test-${stamp}-${Math.random().toString(36).slice(2, 7)}`, name: "Test Merchant", type: "ACTIVITY_PROVIDER", status: "APPROVED", plan, attributionCode: `T${Math.random().toString(36).slice(2, 9).toUpperCase()}`, staff: { create: { userId: u.id, role: "OWNER" } } },
  });
  return { m, owner: u };
}

beforeAll(async () => {
  parent = (await prisma.user.create({ data: { email: `parent${stamp}@test.local`, name: "Test Parent", phone: "96170111222" } })).id;
  admin = (await prisma.user.create({ data: { email: `admin${stamp}@test.local`, name: "Test Admin", roles: { create: [{ role: "SUPER_ADMIN" }] } } })).id;
});

afterAll(async () => {
  for (const c of cleanup.reverse()) await c().catch(() => {});
  await prisma.$disconnect();
});

async function bookPayAtVenue(eventSlug: string, qty = 1) {
  const e = await prisma.event.findUniqueOrThrow({ where: { slug: eventSlug }, include: { sessions: { where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: "desc" } }, ticketTypes: true } });
  await prisma.event.update({ where: { id: e.id }, data: { payAtVenue: true } });
  const { code } = await startBooking({ userId: parent, sessionId: e.sessions[0].id, items: [{ ticketTypeId: e.ticketTypes[0].id, quantity: qty }], locale: "en" });
  await confirmWithoutOnlinePayment(code, parent, "PAY_AT_VENUE");
  return prisma.booking.findUniqueOrThrow({ where: { code }, include: { tickets: true, merchant: true, event: true } });
}

describe("acceptance", () => {
  it("#4 QR tickets are generated and validate exactly once, only for their merchant", async () => {
    const b = await bookPayAtVenue("mini-bakers-manakish-cookies", 2);
    expect(b.tickets).toHaveLength(2);
    const other = await freshMerchant();
    expect((await scanTicket(b.tickets[0].code, other.m.id, admin)).ok).toBe(false); // #17 tenant isolation
    expect((await scanTicket(b.tickets[0].code, b.merchantId, admin)).ok).toBe(true);
    const again = await scanTicket(b.tickets[0].code, b.merchantId, admin);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("used");
  });

  it("#9 booking commission follows the category × plan matrix", async () => {
    // Workshops: Basic 15%, Pro 12%, Featured 10%
    const cases: ["BASIC" | "PRO" | "FEATURED", number][] = [["BASIC", 1500], ["PRO", 1200], ["FEATURED", 1000]];
    const cat = await prisma.category.findUniqueOrThrow({ where: { slug: "arts-crafts" } });
    for (const [plan, expected] of cases) {
      const { m } = await freshMerchant(plan);
      const c = await prisma.$transaction((tx) =>
        recordBookingCommission(tx, { id: `test-${plan}-${stamp}`, code: "X", merchantId: m.id, userId: parent, subtotalCents: 10000, attribution: "EVNT", paymentMethod: "WHISH", eventCategoryId: cat.id, plan }),
      );
      expect(c.amountCents).toBe(expected);
    }
    // Camps on Featured: 8%; merchant-link customers: 0%
    const camps = await prisma.category.findUniqueOrThrow({ where: { slug: "summer-camps" } });
    const { m } = await freshMerchant("FEATURED");
    const c = await prisma.$transaction((tx) => recordBookingCommission(tx, { id: `test-camp-${stamp}`, code: "X", merchantId: m.id, userId: parent, subtotalCents: 10000, attribution: "EVNT", paymentMethod: "WHISH", eventCategoryId: camps.id, plan: "FEATURED" }));
    expect(c.amountCents).toBe(800);
    const link = await prisma.$transaction((tx) => recordBookingCommission(tx, { id: `test-link-${stamp}`, code: "X", merchantId: m.id, userId: parent, subtotalCents: 10000, attribution: "MERCHANT_LINK", paymentMethod: "WHISH", eventCategoryId: camps.id, plan: "FEATURED" }));
    expect(link.amountCents).toBe(0);
  });

  it("#10 a subscription upgrade unlocks features only once its invoice is paid", async () => {
    const { m } = await freshMerchant("BASIC");
    const r = await changePlan(m.id, "FEATURED", "MONTHLY", { useTrial: false });
    expect("invoiceId" in r).toBe(true);
    let fresh = await prisma.merchant.findUniqueOrThrow({ where: { id: m.id } });
    expect((await merchantFeatures(fresh)).birthdayRadar).toBe(false);
    await markInvoicePaid((r as { invoiceId: string }).invoiceId, { recordedById: admin, reference: "TEST" });
    fresh = await prisma.merchant.findUniqueOrThrow({ where: { id: m.id } });
    expect(fresh.plan).toBe("FEATURED");
    expect((await merchantFeatures(fresh)).birthdayRadar).toBe(true);
  });

  it("#11 a paid ad needs payment, then admin approval, and exclusive slots can't overlap", async () => {
    const a = await freshMerchant("FEATURED");
    const b = await freshMerchant("FEATURED");
    const cat = await prisma.category.create({ data: { slug: `test-cat-${stamp}`, name: { en: "Test" }, kind: "EVENT" } });
    cleanup.push(() => prisma.adCampaign.deleteMany({ where: { categoryId: cat.id } }), () => prisma.category.delete({ where: { id: cat.id } }));
    const start = new Date(Date.now() + 86400_000);
    const end = new Date(Date.now() + 20 * 86400_000);
    const c = await createCampaign(a.m.id, admin, { placementCode: "CATEGORY_SPONSOR", startsAt: start, endsAt: end, headline: "Sponsored test", categoryId: cat.id });
    expect(c.status).toBe("PENDING_PAYMENT");
    await expect(reviewCampaign(c.id, true, "", admin)).rejects.toThrow(); // not paid yet
    await expect(createCampaign(b.m.id, admin, { placementCode: "CATEGORY_SPONSOR", startsAt: start, endsAt: end, headline: "Second", categoryId: cat.id })).rejects.toThrow(/already booked/);
    await markInvoicePaid(c.invoiceId!, { recordedById: admin, reference: "TEST" });
    expect((await prisma.adCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDING_APPROVAL");
    await reviewCampaign(c.id, true, "", admin);
    expect((await prisma.adCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("APPROVED");
  });

  it("#12 Farah Approved requires a real assessment — payment alone never grants it", async () => {
    const { m } = await freshMerchant();
    const cert = await applyForCertification(m.id, admin);
    await markInvoicePaid(cert.invoiceId ?? (await prisma.certification.findUniqueOrThrow({ where: { id: cert.id } })).invoiceId!, { recordedById: admin, reference: "TEST" });
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: m.id } })).farahUntil).toBeNull();
    await expect(decideCertification(cert.id, true, "", admin)).rejects.toThrow(); // not assessed
    await scheduleAssessment(cert.id, admin, new Date(Date.now() + 86400_000), admin);
    await submitAssessment(cert.id, admin, true, CHECKLIST.map((c) => ({ key: c.key, passed: true })), "Great");
    await decideCertification(cert.id, true, "ok", admin);
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: m.id } })).farahUntil).toBeNull(); // license not paid yet
    const license = await prisma.invoiceLine.findFirstOrThrow({ where: { refType: "farah-license", refId: cert.id } });
    await markInvoicePaid(license.invoiceId, { recordedById: admin, reference: "TEST" });
    expect((await prisma.merchant.findUniqueOrThrow({ where: { id: m.id } })).farahUntil).not.toBeNull();
  });

  it("#16 reviews are verified only with a completed booking", async () => {
    const e = await prisma.event.findUniqueOrThrow({ where: { slug: "junior-robotics-lab" } });
    await prisma.review.deleteMany({ where: { userId: parent, eventId: e.id } });
    const r1 = await createReview(parent, { eventId: e.id, rating: 5, body: "Lovely workshop, kids loved it!" });
    expect(r1.verified).toBe(false);
    await prisma.review.delete({ where: { id: r1.id } });
    const b = await bookPayAtVenue("junior-robotics-lab");
    await prisma.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
    const r2 = await createReview(parent, { eventId: e.id, rating: 5, body: "Lovely workshop, kids loved it!" });
    expect(r2.verified).toBe(true);
    const owner = await prisma.merchantStaff.findFirstOrThrow({ where: { merchantId: e.merchantId } });
    await expect(createReview(owner.userId, { eventId: e.id, rating: 5, body: "We are the best venue ever" })).rejects.toThrow();
  });

  it("#17 a merchant can't cancel another merchant's booking", async () => {
    const b = await bookPayAtVenue("magic-show-with-captain-bubbles");
    const other = await freshMerchant();
    await expect(cancelBooking(b.code, { userId: other.owner.id, as: "merchant", merchantId: other.m.id }, "x")).rejects.toThrow(/not found/i);
  });

  it("#18 cancellation reverses commission and frees the spot", async () => {
    const b = await bookPayAtVenue("after-school-football-club");
    await markPaidAtVenue(b.code, b.merchantId, admin); // commission recorded (owed by merchant)
    const before = (await prisma.ledgerEntry.aggregate({ where: { merchantId: b.merchantId, refId: b.id }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
    expect(before).toBeLessThan(0);
    const reserved = (await prisma.eventSession.findUniqueOrThrow({ where: { id: b.sessionId } })).reserved;
    await cancelBooking(b.code, { userId: admin, as: "admin" }, "Test cancel");
    const after = (await prisma.ledgerEntry.aggregate({ where: { merchantId: b.merchantId, refId: b.id }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
    expect(after).toBe(0);
    expect((await prisma.eventSession.findUniqueOrThrow({ where: { id: b.sessionId } })).reserved).toBe(reserved - 1);
    expect((await prisma.commission.findUniqueOrThrow({ where: { source_sourceId: { source: "BOOKING", sourceId: b.id } } })).status).toBe("REVERSED");
  });

  it("#5 a restaurant receives, accepts and completes a reservation; fee is per verified guest", async () => {
    const r = await prisma.restaurant.findUniqueOrThrow({ where: { slug: "cafe-bloom" }, include: { merchant: true } });
    const d = beirutYmd(addDays(new Date(), 2));
    const res = await requestReservation(parent, { restaurantId: r.id, startsAt: beirutTime(d.y, d.m, d.d, 13, 0), adults: 2, children: 2, phone: "96170111222" });
    expect(res.status).toBe("REQUESTED");
    await respondReservation(res.code, r.merchantId, admin, "accept");
    await prisma.restaurantReservation.update({ where: { id: res.id }, data: { startsAt: new Date(Date.now() - 3600_000) } });
    await completeReservation(res.code, r.merchantId, admin, 3);
    const c = await prisma.commission.findUniqueOrThrow({ where: { source_sourceId: { source: "RESERVATION", sourceId: res.id } } });
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: r.merchant.plan } });
    expect(c.amountCents).toBe(3 * plan.restaurantGuestFeeCents);
    // A no-show is never charged
    const res2 = await requestReservation(parent, { restaurantId: r.id, startsAt: beirutTime(d.y, d.m, d.d, 20, 0), adults: 2, children: 0, phone: "96170111222" });
    await respondReservation(res2.code, r.merchantId, admin, "accept");
    await prisma.restaurantReservation.update({ where: { id: res2.id }, data: { startsAt: new Date(Date.now() - 3600_000) } });
    await completeReservation(res2.code, r.merchantId, admin, "no-show");
    expect(await prisma.commission.count({ where: { source: "RESERVATION", sourceId: res2.id } })).toBe(0);
  });
});
