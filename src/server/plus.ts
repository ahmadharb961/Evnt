import "server-only";

// Filled in by its phase; payments for this purpose cannot be started before then.
export async function applyMembershipPayment(_paymentId: string, _outcome: "success" | "failed"): Promise<void> {
  throw new Error("applyMembershipPayment is not available yet");
}
