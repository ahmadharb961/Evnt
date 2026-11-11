import type { PrismaClient } from "@prisma/client";
import { reindexEvent, reindexProduct, reindexRestaurant } from "./listings";

/** Rebuilds the search text of every listing (seed / admin maintenance). */
export async function reindexAll(prisma: PrismaClient) {
  for (const e of await prisma.event.findMany({ select: { id: true } })) await reindexEvent(e.id);
  for (const r of await prisma.restaurant.findMany({ select: { id: true } })) await reindexRestaurant(r.id);
  for (const p of await prisma.product.findMany({ select: { id: true } })) await reindexProduct(p.id);
}
