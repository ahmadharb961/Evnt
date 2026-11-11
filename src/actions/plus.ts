"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, UserError } from "@/server/auth";
import { cancelMembership, prepareMembership, resumeMembership } from "@/server/plus";
import { startWhishPayment } from "@/server/payments";
import { getT } from "@/i18n/server";

export async function joinPlusAction(interval: "MONTHLY" | "YEARLY") {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/plus");
  let url: string;
  try {
    const m = await prepareMembership(user.id, interval);
    ({ redirectUrl: url } = await startWhishPayment({ purpose: "MEMBERSHIP", amountCents: m.priceCents, description: `EVNT+ ${interval === "YEARLY" ? "yearly" : "monthly"}`, userId: user.id, membershipId: m.id, returnPath: "/plus" }));
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(url);
}

export async function cancelPlusAction() {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  try {
    await cancelMembership(user.id);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath("/plus");
  return {};
}

export async function resumePlusAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await resumeMembership(user.id);
  revalidatePath("/plus");
}
