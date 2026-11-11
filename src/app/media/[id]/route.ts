import { prisma } from "@/server/db";

// Public media (listing photos, hero video). Immutable: a new upload gets a new id.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const m = await prisma.media.findUnique({ where: { id }, select: { mime: true, data: true, size: true, sha256: true } });
  if (!m) return new Response("Not found", { status: 404 });
  const etag = `"${m.sha256.slice(0, 32)}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });
  const headers: Record<string, string> = {
    "content-type": m.mime,
    "cache-control": "public, max-age=31536000, immutable",
    etag,
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  const data = Buffer.from(m.data);
  // Range requests let browsers (Safari especially) stream the hero video.
  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? parseInt(match[1], 10) : Math.max(0, data.length - parseInt(match[2], 10));
    const end = match[1] && match[2] ? Math.min(parseInt(match[2], 10), data.length - 1) : data.length - 1;
    if (start >= data.length || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${data.length}` } });
    return new Response(data.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${data.length}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(data, { headers: { ...headers, "content-length": String(data.length) } });
}
