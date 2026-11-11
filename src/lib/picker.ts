export type PickKind = "merchant" | "event" | "restaurant" | "product";
export type PickItem = { id: string; kind: PickKind; label: string; sub: string; image: string };
export const PICK_KINDS: PickKind[] = ["merchant", "event", "restaurant", "product"];
