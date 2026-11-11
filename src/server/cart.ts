import "server-only";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";
import { deviceId } from "./request";

/** The visitor's cart: the account's cart when signed in, otherwise this device's. */
export async function findCart(create = false) {
  const user = await getCurrentUser();
  const did = await deviceId();
  if (user) {
    const c = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (c || !create) return c;
    return prisma.cart.create({ data: { userId: user.id } });
  }
  if (!did) return null;
  const c = await prisma.cart.findUnique({ where: { deviceId: did } });
  if (c || !create) return c;
  return prisma.cart.create({ data: { deviceId: did } });
}

export async function cartCount(): Promise<number> {
  try {
    const cart = await findCart();
    if (!cart) return 0;
    const r = await prisma.cartItem.aggregate({ where: { cartId: cart.id }, _sum: { quantity: true } });
    return r._sum.quantity ?? 0;
  } catch {
    return 0;
  }
}

/** After sign-in: move this device's cart items into the account's cart. */
export async function mergeDeviceCart(userId: string) {
  const did = await deviceId();
  if (!did) return;
  const guest = await prisma.cart.findUnique({ where: { deviceId: did }, include: { items: true } });
  if (!guest || !guest.items.length) return;
  const mine = (await prisma.cart.findUnique({ where: { userId } })) ?? (await prisma.cart.create({ data: { userId } }));
  await prisma.$transaction(async (tx) => {
    for (const it of guest.items) {
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: mine.id, variantId: it.variantId } },
        create: { cartId: mine.id, variantId: it.variantId, quantity: it.quantity },
        update: { quantity: { increment: it.quantity } },
      });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
