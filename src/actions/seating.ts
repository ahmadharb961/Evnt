"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireMerchant } from "@/server/auth";
import { getT } from "@/i18n/server";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  width: z.number().int().min(2).max(60),
  height: z.number().int().min(2).max(60),
  zones: z.array(z.object({ key: z.string().regex(/^[a-z0-9-]{1,20}$/), name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(1).max(8),
  labels: z.array(z.object({ text: z.string().trim().min(1).max(30), x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(1).max(60) })).max(10),
  seats: z
    .array(z.object({ label: z.string().trim().min(1).max(12), row: z.string().max(4).nullable(), x: z.number().int().min(0).max(60), y: z.number().int().min(0).max(60), kind: z.enum(["SEAT", "TABLE", "SPOT", "STATION"]), zone: z.string(), accessible: z.boolean(), blocked: z.boolean() }))
    .max(2000),
});

export async function saveSeatingMapAction(payload: z.infer<typeof schema>): Promise<{ error?: string; id?: string }> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const p = schema.safeParse(payload);
  if (!p.success) return { error: t("Please check the map: some values are invalid.") };
  const d = p.data;
  if (!d.seats.length) return { error: t("Add at least one seat or spot.") };
  const zoneKeys = new Set(d.zones.map((z) => z.key));
  if (d.seats.some((s) => !zoneKeys.has(s.zone))) return { error: t("Every seat needs a zone.") };
  const labels = new Set<string>();
  for (const s of d.seats) {
    if (labels.has(s.label)) return { error: t("Two places share the label {label}.", { label: s.label }) };
    labels.add(s.label);
  }
  try {
    const id = await prisma.$transaction(async (tx) => {
      let mapId = d.id;
      if (mapId) {
        const m = await tx.seatingMap.findUnique({ where: { id: mapId } });
        if (!m || m.merchantId !== ctx.merchant.id) throw new Error("not-found");
        await tx.seatingMap.update({ where: { id: mapId }, data: { name: d.name, width: d.width, height: d.height, zones: d.zones, labels: d.labels, version: { increment: 1 } } });
      } else {
        mapId = (await tx.seatingMap.create({ data: { merchantId: ctx.merchant.id, name: d.name, width: d.width, height: d.height, zones: d.zones, labels: d.labels } })).id;
      }
      const existing = await tx.seat.findMany({ where: { mapId }, include: { _count: { select: { claims: true } } } });
      // Places are matched by grid position, so moving labels around never moves a booked seat.
      const pos = (x: number, y: number) => `${x},${y}`;
      const byPos = new Map(existing.map((s) => [pos(s.x, s.y), s]));
      const keep = new Set(d.seats.map((s) => pos(s.x, s.y)));
      const removed = existing.filter((s) => !keep.has(pos(s.x, s.y)));
      const locked = removed.filter((s) => s._count.claims > 0);
      if (locked.length) throw new Error(`locked:${locked.map((s) => s.label).slice(0, 5).join(", ")}`);
      if (removed.length) await tx.seat.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
      // Free the labels first (unique per map), then write the final ones.
      await tx.$executeRaw`UPDATE "Seat" SET label = '~' || id WHERE "mapId" = ${mapId}`;
      for (const s of d.seats) {
        const prev = byPos.get(pos(s.x, s.y));
        if (prev) await tx.seat.update({ where: { id: prev.id }, data: { label: s.label, row: s.row, kind: s.kind, zone: s.zone, accessible: s.accessible, blocked: s.blocked } });
        else await tx.seat.create({ data: { mapId: mapId!, ...s } });
      }
      await tx.auditLog.create({ data: { actorId: ctx.user.id, action: d.id ? "seating.updated" : "seating.created", entityType: "seatingMap", entityId: mapId, data: { seats: d.seats.length, removed: removed.length } } });
      return mapId!;
    });
    revalidatePath("/merchant/seating");
    return { id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("locked:")) return { error: t("These places have bookings and can't be removed: {list}. Block them instead.", { list: msg.slice(7) }) };
    if (msg === "not-found") return { error: t("Not found") };
    throw e;
  }
}

export async function deleteSeatingMapAction(id: string) {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const m = await prisma.seatingMap.findUnique({ where: { id }, include: { _count: { select: { events: true } } } });
  if (!m || m.merchantId !== ctx.merchant.id) return { error: t("Not found") };
  if (m._count.events) return { error: t("This map is used by a listing. Switch the listing to another map first.") };
  await prisma.seatingMap.delete({ where: { id } });
  revalidatePath("/merchant/seating");
  return {};
}
