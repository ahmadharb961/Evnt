// Display names and tones for every operational status.

export type Tone = "mint" | "peach" | "powder" | "blush" | "gray" | "red";

export const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "peach" },
  RESERVED_PAY_AT_VENUE: { label: "Reserved · pay at venue", tone: "powder" },
  CONFIRMED: { label: "Confirmed", tone: "mint" },
  COMPLETED: { label: "Completed", tone: "gray" },
  CANCELED: { label: "Cancelled", tone: "red" },
  EXPIRED: { label: "Expired", tone: "gray" },
  REFUNDED: { label: "Refunded", tone: "gray" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "gray" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "peach" },
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "peach" },
  CONFIRMED: { label: "Confirmed", tone: "powder" },
  PREPARING: { label: "Preparing", tone: "powder" },
  SHIPPED: { label: "Shipped", tone: "blush" },
  DELIVERED: { label: "Delivered", tone: "mint" },
  CANCELED: { label: "Cancelled", tone: "red" },
  REFUNDED: { label: "Refunded", tone: "gray" },
};

export const RESERVATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Requested", tone: "peach" },
  ACCEPTED: { label: "Accepted", tone: "mint" },
  REJECTED: { label: "Declined", tone: "red" },
  PROPOSED: { label: "New time proposed", tone: "blush" },
  CANCELED: { label: "Cancelled", tone: "gray" },
  NO_SHOW: { label: "No-show", tone: "gray" },
  COMPLETED: { label: "Completed", tone: "gray" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  INITIATED: { label: "Started", tone: "gray" },
  PENDING: { label: "Pending", tone: "peach" },
  SUCCEEDED: { label: "Paid", tone: "mint" },
  FAILED: { label: "Failed", tone: "red" },
  CANCELED: { label: "Cancelled", tone: "gray" },
  REFUNDED: { label: "Refunded", tone: "gray" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "gray" },
};

/** Allowed order status moves for merchants (admins may override). */
export const ORDER_FLOW: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELED"],
  AWAITING_PAYMENT: ["CANCELED"],
  CONFIRMED: ["PREPARING", "SHIPPED", "CANCELED"],
  PREPARING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  CANCELED: [],
  REFUNDED: [],
};

export const TONE_CLASS: Record<Tone, string> = {
  mint: "bg-mint-soft text-mint-deep",
  peach: "bg-peach-soft text-peach-deep",
  powder: "bg-powder-soft text-powder-deep",
  blush: "bg-blush-soft text-blush-deep",
  gray: "bg-ink/[.06] text-ink-soft",
  red: "bg-red-50 text-red-700",
};
