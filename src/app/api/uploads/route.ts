import { NextResponse } from "next/server";
import { getCurrentUser, getMerchantContext, UserError } from "@/server/auth";
import { storeUpload } from "@/server/media";
import { rateLimit } from "@/server/rate-limit";

// Image (and admin/merchant video) uploads. Returns the media id.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 60, 10 * 60_000).ok) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
  const merchant = await getMerchantContext();
  const isStaff = user.roles.length > 0;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "image");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file" }, { status: 400 });
  // Parents may upload review photos only; videos are for merchants and admins.
  const allowVideo = kind === "video" && (isStaff || !!merchant);
  try {
    const id = await storeUpload(file, { userId: user.id, merchantId: merchant?.merchant.id }, { allowVideo });
    return NextResponse.json({ id, url: `/media/${id}` });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
