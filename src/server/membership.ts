import "server-only";
import { prisma, type Tx } from "./db";
import { getSetting } from "./settings";

/** EVNT+ is active when paid (or in an admin-granted period) and not past its period end. */
export async function isMember(userId: string | null | undefined, tx?: Tx): Promise<boolean> {
  if (!userId) return false;
  const m = await (tx ?? prisma).membership.findUnique({ where: { userId } });
  return !!m && m.status === "ACTIVE" && (!m.currentPeriodEnd || m.currentPeriodEnd > new Date());
}

export async function pointsBalance(userId: string) {
  const r = await prisma.loyaltyEntry.aggregate({ where: { userId }, _sum: { points: true } });
  return r._sum.points ?? 0;
}

/** Points for a paid amount: 1 point per dollar by default, doubled for EVNT+. Idempotent per reference. */
export async function awardPoints(tx: Tx, userId: string, paidCents: number, member: boolean, ref: { type: string; id: string }) {
  const per = await getSetting("loyalty.pointsPerDollar");
  const mult = member ? await getSetting("loyalty.memberMultiplier") : 1;
  const points = Math.floor((paidCents / 100) * per * mult);
  if (points <= 0) return 0;
  await tx.loyaltyEntry.upsert({
    where: { userId_refType_refId_reason: { userId, refType: ref.type, refId: ref.id, reason: "earned" } },
    create: { userId, points, reason: "earned", refType: ref.type, refId: ref.id },
    update: {},
  });
  return points;
}

export async function reversePoints(tx: Tx, userId: string, ref: { type: string; id: string }) {
  const earned = await tx.loyaltyEntry.findUnique({ where: { userId_refType_refId_reason: { userId, refType: ref.type, refId: ref.id, reason: "earned" } } });
  if (!earned) return;
  await tx.loyaltyEntry.upsert({
    where: { userId_refType_refId_reason: { userId, refType: ref.type, refId: ref.id, reason: "reversed" } },
    create: { userId, points: -earned.points, reason: "reversed", refType: ref.type, refId: ref.id },
    update: {},
  });
}
