// Integration: real database. Proves no double booking under concurrency and that expired holds release.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { startBooking, releaseExpiredHolds, sessionRemaining } from "@/server/booking";

let users: string[] = [];
let seatedSession = "";
let seatId = "";
let gaSession = "";
let gaTicket = "";

beforeAll(async () => {
  const theater = await prisma.event.findFirstOrThrow({ where: { seatingMode: "ASSIGNED" }, include: { sessions: { orderBy: { startsAt: "desc" } } } });
  seatedSession = theater.sessions[0].id;
  const seat = await prisma.seat.findFirstOrThrow({ where: { mapId: theater.seatingMapId!, label: "I5" } });
  seatId = seat.id;
  await prisma.seatClaim.deleteMany({ where: { sessionId: seatedSession, seatId } });
  const ga = await prisma.event.findFirstOrThrow({ where: { seatingMode: "GENERAL", isFree: false }, include: { sessions: { orderBy: { startsAt: "desc" } }, ticketTypes: true } });
  const s = await prisma.eventSession.create({ data: { eventId: ga.id, startsAt: new Date(Date.now() + 40 * 86400_000), endsAt: new Date(Date.now() + 40 * 86400_000 + 3600_000), capacity: 5 } });
  gaSession = s.id;
  gaTicket = ga.ticketTypes[0].id;
  for (let i = 0; i < 12; i++) {
    const u = await prisma.user.create({ data: { email: `race${Date.now()}_${i}@test.local`, name: `Race ${i}`, phone: "96170000001" } });
    users.push(u.id);
  }
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { userId: { in: users } } });
  await prisma.inventoryHold.deleteMany({ where: { userId: { in: users } } });
  await prisma.eventSession.delete({ where: { id: gaSession } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("inventory", () => {
  it("only one of 12 simultaneous parents gets the same seat", async () => {
    const results = await Promise.allSettled(users.map((userId) => startBooking({ userId, sessionId: seatedSession, items: [], seatIds: [seatId], locale: "en" })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(await prisma.seatClaim.count({ where: { sessionId: seatedSession, seatId } })).toBe(1);
  });

  it("never sells more general-admission spots than capacity", async () => {
    const results = await Promise.allSettled(users.map((userId) => startBooking({ userId, sessionId: gaSession, items: [{ ticketTypeId: gaTicket, quantity: 1 }], locale: "en" })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    expect(await sessionRemaining(gaSession)).toBe(0);
  });

  it("expired holds release spots and expire the booking", async () => {
    await prisma.inventoryHold.updateMany({ where: { sessionId: gaSession }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.seatClaim.updateMany({ where: { sessionId: seatedSession, seatId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.inventoryHold.updateMany({ where: { sessionId: seatedSession, userId: { in: users } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await releaseExpiredHolds();
    expect(await sessionRemaining(gaSession)).toBe(5);
    expect(await prisma.seatClaim.count({ where: { sessionId: seatedSession, seatId } })).toBe(0);
    expect(await prisma.booking.count({ where: { sessionId: gaSession, status: "EXPIRED" } })).toBe(5);
  });
});
