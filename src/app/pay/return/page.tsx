import { redirect } from "next/navigation";
import { syncWhishPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";

// Back from the Whish payment page: confirm the real status with Whish, then continue.
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ pid?: string; next?: string }> }) {
  const { pid = "", next = "/account" } = await searchParams;
  const user = await getCurrentUser();
  const p = /^[a-z0-9]{20,40}$/.test(pid) ? await prisma.payment.findUnique({ where: { id: pid } }) : null;
  if (p && user && (p.userId === user.id || !p.userId)) await syncWhishPayment(p.id).catch(() => null);
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  redirect(safe + (safe.includes("?") ? "&" : "?") + "paid=1");
}
