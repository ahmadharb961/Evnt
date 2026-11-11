import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { deviceId } from "@/server/request";
import { appUrl } from "@/server/urls";

// Outbound contact (WhatsApp / phone / website) from an EVNT listing. The click is logged because it
// opens the 72-hour window in which a verified external booking earns EVNT 50% of the commission.
export async function GET(req: NextRequest, { params }: { params: Promise<{ channel: string; merchant: string }> }) {
  const { channel, merchant: slug } = await params;
  const m = await prisma.merchant.findUnique({ where: { slug } });
  if (!m || m.status !== "APPROVED") return NextResponse.redirect(appUrl());
  const targetType = req.nextUrl.searchParams.get("t")?.slice(0, 20) || null;
  const targetId = req.nextUrl.searchParams.get("id")?.slice(0, 40) || null;
  let to: string | null = null;
  if (channel === "whatsapp" && m.whatsapp) {
    const text = req.nextUrl.searchParams.get("text")?.slice(0, 300) ?? "Hello! I found you on EVNT.";
    to = `https://wa.me/${m.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  } else if (channel === "phone" && m.phone) to = `tel:+${m.phone.replace(/\D/g, "")}`;
  else if (channel === "website" && m.website && /^https?:\/\//.test(m.website)) to = m.website;
  if (!to) return NextResponse.redirect(`${appUrl()}/m/${m.slug}`);
  const user = await getCurrentUser();
  await prisma.contactClick.create({ data: { merchantId: m.id, userId: user?.id, deviceId: await deviceId(), channel, targetType, targetId } });
  return NextResponse.redirect(to);
}
