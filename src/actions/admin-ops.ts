"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { requireAdmin, UserError } from "@/server/auth";
import { updateOrderStatus } from "@/server/orders";
import { prisma } from "@/server/db";

/** Admin dispute resolution on a shop order (bypasses the merchant flow rules). */
export async function adminOrderStatusAction(orderNumber: string, status: OrderStatus, reason?: string) {
  const u = await requireAdmin("ADMIN");
  try {
    await updateOrderStatus(orderNumber, null, u.id, status, { reason: reason ? `EVNT: ${reason}` : "Cancelled by EVNT" });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/orders");
  return {};
}

export async function qualifyInquiryAction(id: string, qualified: boolean) {
  const u = await requireAdmin("ADMIN");
  await prisma.birthdayInquiry.update({ where: { id }, data: { qualified } });
  await prisma.auditLog.create({ data: { actorId: u.id, action: qualified ? "inquiry.qualified" : "inquiry.unqualified", entityType: "birthdayInquiry", entityId: id } });
  revalidatePath("/admin/birthdays");
  return {};
}
