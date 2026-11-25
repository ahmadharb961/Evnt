import type { Role } from "@prisma/client";
import type { Tone } from "@/lib/tones";

/** Plain-language admin roles, shown when creating team members. */
export const ROLE_INFO: { role: Role; label: string; desc: string; tone: Tone }[] = [
  { role: "SUPER_ADMIN", label: "Super admin", desc: "Full access to everything, including platform settings and the admin team.", tone: "violet" },
  { role: "ADMIN", label: "Operations", desc: "Businesses, users, listings, bookings, orders and advertising.", tone: "sky" },
  { role: "FINANCE", label: "Finance", desc: "Payments, invoices, commissions, refunds and payouts.", tone: "emerald" },
  { role: "CONTENT", label: "Content", desc: "Homepage, listings, reviews, marketing and translations.", tone: "peach" },
];
