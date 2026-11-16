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

type Map = Record<string, { label: string; tone: Tone }>;

export const MERCHANT_STATUS: Map = {
  ONBOARDING: { label: "Setting up", tone: "gray" },
  PENDING: { label: "Waiting for approval", tone: "peach" },
  APPROVED: { label: "Approved", tone: "mint" },
  REJECTED: { label: "Rejected", tone: "red" },
  SUSPENDED: { label: "Suspended", tone: "red" },
};

export const MERCHANT_TYPE: Map = {
  ACTIVITY_PROVIDER: { label: "Activity provider", tone: "peach" },
  VENUE: { label: "Venue", tone: "powder" },
  RESTAURANT: { label: "Restaurant", tone: "mint" },
  RETAILER: { label: "Shop", tone: "blush" },
  BIRTHDAY_SERVICE: { label: "Birthday services", tone: "peach" },
  EVENT_ORGANIZER: { label: "Event organizer", tone: "powder" },
};

export const PLAN: Map = {
  BASIC: { label: "Basic", tone: "gray" },
  PRO: { label: "Pro", tone: "powder" },
  FEATURED: { label: "Featured", tone: "blush" },
};

export const PAYMENT_METHOD: Map = {
  WHISH: { label: "Card (Whish)", tone: "mint" },
  PAY_AT_VENUE: { label: "Pay at venue", tone: "powder" },
  COD: { label: "Cash on delivery", tone: "peach" },
  FREE: { label: "Free", tone: "gray" },
  OFFLINE: { label: "Offline", tone: "gray" },
};

export const ATTRIBUTION: Map = {
  EVNT: { label: "Via EVNT", tone: "mint" },
  EVNT_EXTERNAL: { label: "EVNT contact, booked directly", tone: "powder" },
  MERCHANT_LINK: { label: "Business's own customer", tone: "gray" },
};

export const REFUND_STATUS: Map = {
  REQUESTED: { label: "Requested", tone: "peach" },
  APPROVED: { label: "Approved", tone: "powder" },
  PROCESSED: { label: "Refunded", tone: "mint" },
  REJECTED: { label: "Declined", tone: "red" },
};

export const INVOICE_STATUS: Map = {
  OPEN: { label: "Unpaid", tone: "peach" },
  PAID: { label: "Paid", tone: "mint" },
  VOID: { label: "Cancelled", tone: "gray" },
  OVERDUE: { label: "Overdue", tone: "red" },
};

export const CAMPAIGN_STATUS: Map = {
  DRAFT: { label: "Draft", tone: "gray" },
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "peach" },
  PENDING_APPROVAL: { label: "Waiting for review", tone: "peach" },
  APPROVED: { label: "Running", tone: "mint" },
  REJECTED: { label: "Rejected", tone: "red" },
  ENDED: { label: "Ended", tone: "gray" },
  CANCELED: { label: "Cancelled", tone: "gray" },
};

export const CERT_STATUS: Map = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "peach" },
  PAID: { label: "Paid, to schedule", tone: "powder" },
  SCHEDULED: { label: "Visit scheduled", tone: "powder" },
  ASSESSED: { label: "Assessed, needs decision", tone: "blush" },
  APPROVED: { label: "Approved", tone: "mint" },
  REJECTED: { label: "Not approved", tone: "red" },
  EXPIRED: { label: "Expired", tone: "gray" },
  CANCELED: { label: "Cancelled", tone: "gray" },
};

export const COMMISSION_STATUS: Map = {
  PENDING: { label: "Pending", tone: "peach" },
  EARNED: { label: "Earned", tone: "mint" },
  REVERSED: { label: "Reversed", tone: "red" },
  INVOICED: { label: "Invoiced", tone: "powder" },
  SETTLED: { label: "Settled", tone: "gray" },
};

export const SUBSCRIPTION_STATUS: Map = {
  TRIALING: { label: "Free trial", tone: "blush" },
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "peach" },
  ACTIVE: { label: "Active", tone: "mint" },
  PAST_DUE: { label: "Overdue", tone: "red" },
  GRACE: { label: "Grace period", tone: "peach" },
  CANCELED: { label: "Cancelled", tone: "gray" },
  EXPIRED: { label: "Expired", tone: "gray" },
};

/** Display name for a status code (pass through t()). */
export const labelOf = (map: Map, code: string | null | undefined) => (code ? (map[code]?.label ?? code) : "—");

export const COMMISSION_SOURCE: Map = {
  BOOKING: { label: "Booking", tone: "mint" },
  ORDER: { label: "Shop order", tone: "blush" },
  RESERVATION: { label: "Restaurant table", tone: "powder" },
};

export const CATEGORY: Map = {
  WORKSHOPS: { label: "Workshops", tone: "peach" },
  CAMPS: { label: "Camps", tone: "mint" },
  SHOWS: { label: "Shows", tone: "blush" },
  BIRTHDAYS: { label: "Birthdays", tone: "peach" },
  FAMILY_EXPERIENCES: { label: "Family experiences", tone: "powder" },
  RETAIL: { label: "Shop sales", tone: "blush" },
};

export const CERT_KIND: Map = {
  INITIAL: { label: "First assessment", tone: "powder" },
  RENEWAL: { label: "Renewal", tone: "mint" },
  REEVALUATION: { label: "Re-inspection", tone: "peach" },
};
