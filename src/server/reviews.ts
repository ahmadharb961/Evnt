import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { UserError } from "./auth";

export type ReviewTarget = { eventId?: string; restaurantId?: string; productId?: string; merchantId?: string };

export async function listReviews(target: ReviewTarget, take = 20) {
  const where: Prisma.ReviewWhereInput = { status: "PUBLISHED", ...target };
  const [items, groups] = await Promise.all([
    prisma.review.findMany({ where, orderBy: [{ verified: "desc" }, { createdAt: "desc" }], take, include: { user: { select: { name: true } } } }),
    prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);
  const breakdown = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: groups.find((g) => g.rating === r)?._count._all ?? 0 }));
  const total = breakdown.reduce((a, b) => a + b.count, 0);
  const avg = total ? breakdown.reduce((a, b) => a + b.rating * b.count, 0) / total : 0;
  return {
    items: items.map((r) => ({
      id: r.id,
      // First name + initial only: protects parents' privacy.
      author: r.user.name.split(" ")[0] + (r.user.name.split(" ")[1] ? ` ${r.user.name.split(" ")[1][0]}.` : ""),
      rating: r.rating,
      body: r.body,
      photos: r.photos,
      verified: r.verified,
      reply: r.merchantReply,
      createdAt: r.createdAt,
    })),
    breakdown,
    total,
    avg,
  };
}

/** Recomputes cached rating fields from published reviews (never editable directly). */
export async function refreshRatings(target: { eventId?: string | null; restaurantId?: string | null; productId?: string | null; merchantId: string }) {
  const agg = async (where: Prisma.ReviewWhereInput) => prisma.review.aggregate({ where: { ...where, status: "PUBLISHED" }, _avg: { rating: true }, _count: { _all: true } });
  if (target.eventId) {
    const a = await agg({ eventId: target.eventId });
    await prisma.event.update({ where: { id: target.eventId }, data: { ratingAvg: a._avg.rating ?? 0, ratingCount: a._count._all } });
  }
  if (target.restaurantId) {
    const a = await agg({ restaurantId: target.restaurantId });
    await prisma.restaurant.update({ where: { id: target.restaurantId }, data: { ratingAvg: a._avg.rating ?? 0, ratingCount: a._count._all } });
  }
  if (target.productId) {
    const a = await agg({ productId: target.productId });
    await prisma.product.update({ where: { id: target.productId }, data: { ratingAvg: a._avg.rating ?? 0, ratingCount: a._count._all } });
  }
  const m = await agg({ merchantId: target.merchantId });
  await prisma.merchant.update({ where: { id: target.merchantId }, data: { ratingAvg: m._avg.rating ?? 0, ratingCount: m._count._all } });
}

/**
 * Creates a review. "Verified" is decided here, server-side, only from a qualifying record:
 * a COMPLETED booking of that event, a DELIVERED order containing that product, or a COMPLETED
 * reservation at that restaurant — all belonging to the reviewer.
 */
export async function createReview(userId: string, input: { eventId?: string; restaurantId?: string; productId?: string; rating: number; body: string; photos?: string[] }) {
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 5) throw new UserError("Choose a rating from 1 to 5");
  const body = input.body.trim();
  if (body.length < 10) throw new UserError("Tell other parents a little more (at least 10 characters)");
  if (body.length > 2000) throw new UserError("Your review is too long");
  let merchantId: string;
  let verifiedBy: { bookingId?: string; orderId?: string; reservationId?: string } = {};
  if (input.eventId) {
    const e = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!e) throw new UserError("Not found");
    merchantId = e.merchantId;
    const b = await prisma.booking.findFirst({ where: { userId, eventId: e.id, status: "COMPLETED" }, orderBy: { createdAt: "desc" } });
    if (b) verifiedBy = { bookingId: b.id };
  } else if (input.restaurantId) {
    const r = await prisma.restaurant.findUnique({ where: { id: input.restaurantId } });
    if (!r) throw new UserError("Not found");
    merchantId = r.merchantId;
    const res = await prisma.restaurantReservation.findFirst({ where: { userId, restaurantId: r.id, status: "COMPLETED" } });
    if (res) verifiedBy = { reservationId: res.id };
  } else if (input.productId) {
    const p = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!p) throw new UserError("Not found");
    merchantId = p.merchantId;
    const o = await prisma.order.findFirst({ where: { group: { userId }, status: "DELIVERED", items: { some: { productId: p.id } } } });
    if (o) verifiedBy = { orderId: o.id };
  } else throw new UserError("Not found");

  const staff = await prisma.merchantStaff.findFirst({ where: { merchantId, userId } });
  if (staff) throw new UserError("Businesses can't review their own listings");

  try {
    const review = await prisma.review.create({
      data: { userId, merchantId, eventId: input.eventId, restaurantId: input.restaurantId, productId: input.productId, rating, body, photos: input.photos ?? [], verified: !!(verifiedBy.bookingId || verifiedBy.orderId || verifiedBy.reservationId), ...verifiedBy },
    });
    await refreshRatings({ eventId: input.eventId, restaurantId: input.restaurantId, productId: input.productId, merchantId });
    return review;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new UserError("You've already reviewed this");
    throw e;
  }
}
