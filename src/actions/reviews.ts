"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getCurrentUser, UserError } from "@/server/auth";
import { createReview } from "@/server/reviews";
import { rateLimit } from "@/server/rate-limit";
import { getT } from "@/i18n/server";

export type ReviewState = { error?: string; ok?: boolean; verified?: boolean } | undefined;

export async function createReviewAction(_: ReviewState, form: FormData): Promise<ReviewState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  if (!rateLimit(`review:${user.id}`, 10, 3600_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  try {
    const r = await createReview(user.id, {
      eventId: String(form.get("eventId") || "") || undefined,
      restaurantId: String(form.get("restaurantId") || "") || undefined,
      productId: String(form.get("productId") || "") || undefined,
      rating: Number(form.get("rating")),
      body: String(form.get("body") || ""),
    });
    revalidatePath("/", "layout");
    return { ok: true, verified: r.verified };
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
}

export async function reportReviewAction(reviewId: string, reason: string) {
  const user = await getCurrentUser();
  if (!rateLimit(`report:${user?.id ?? "anon"}`, 10, 3600_000).ok) return { ok: false };
  const r = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!r) return { ok: false };
  await prisma.reviewReport.create({ data: { reviewId, reporterId: user?.id, reason: reason.slice(0, 500) || "Reported" } });
  return { ok: true };
}
