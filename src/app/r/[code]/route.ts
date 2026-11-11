import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { appUrl } from "@/server/urls";

// Merchant attribution link: customers the merchant brings themselves book commission-free (30 days).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const m = await prisma.merchant.findUnique({ where: { attributionCode: code.toUpperCase() } });
  if (!m || m.status !== "APPROVED") return NextResponse.redirect(appUrl());
  const res = NextResponse.redirect(`${appUrl()}/m/${m.slug}`);
  res.cookies.set("evnt_ref", `${m.attributionCode}.${Date.now()}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  return res;
}
