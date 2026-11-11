import "server-only";
import sharp from "sharp";
import { prisma } from "./db";
import { sha256 } from "./crypto";
import { UserError } from "./auth";

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
export const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 35 * 1024 * 1024;

/** Media URL for an id (stored media) or a pass-through URL; falls back to the brand placeholder. */
export function mediaSrc(id?: string | null, url?: string | null): string {
  if (id) return `/media/${id}`;
  if (url) return url;
  return "/brand/placeholder.svg";
}

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buf.subarray(4, 8).toString() === "ftyp") {
    const brand = buf.subarray(8, 12).toString();
    if (brand.startsWith("avi")) return "image/avif";
    return "video/mp4";
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

/**
 * Stores an upload after checking its real type from the bytes (never trusting the filename).
 * Images are re-encoded to WebP (max 1800px), which also strips metadata such as GPS.
 */
export async function storeUpload(file: File, owner: { userId?: string; merchantId?: string }, opts: { allowVideo?: boolean } = {}) {
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) throw new UserError("Unsupported file type. Use JPG, PNG or WebP images" + (opts.allowVideo ? " or MP4 video" : ""));
  if (VIDEO_TYPES.has(type)) {
    if (!opts.allowVideo) throw new UserError("Videos aren't allowed here");
    if (buf.length > MAX_VIDEO) throw new UserError("Video is too large (max 35 MB). Compress it first.");
    const m = await prisma.media.create({ data: { mime: type, size: buf.length, sha256: sha256(buf), data: new Uint8Array(buf), ownerId: owner.userId, merchantId: owner.merchantId } });
    return m.id;
  }
  if (buf.length > MAX_IMAGE) throw new UserError("Image is too large (max 15 MB)");
  const img = sharp(buf, { failOn: "error" }).rotate();
  const out = await img.resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const m = await prisma.media.create({
    data: {
      mime: "image/webp",
      size: out.data.length,
      width: out.info.width,
      height: out.info.height,
      sha256: sha256(out.data),
      data: new Uint8Array(out.data),
      ownerId: owner.userId,
      merchantId: owner.merchantId,
    },
  });
  return m.id;
}
