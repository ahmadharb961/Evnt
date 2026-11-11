"use server";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

const TYPES = new Set(["event", "restaurant", "product"]);

/** Toggles a favorite. Returns { needsLogin } for guests so the button can send them to sign in. */
export async function toggleFavoriteAction(targetType: string, targetId: string) {
  const user = await getCurrentUser();
  if (!user) return { needsLogin: true as const };
  if (!TYPES.has(targetType) || !/^[a-z0-9]{10,40}$/.test(targetId)) return { error: "Invalid" };
  const key = { userId_targetType_targetId: { userId: user.id, targetType, targetId } };
  const existing = await prisma.favorite.findUnique({ where: key });
  if (existing) {
    await prisma.favorite.delete({ where: key });
    return { saved: false };
  }
  await prisma.favorite.create({ data: { userId: user.id, targetType, targetId } });
  return { saved: true };
}
