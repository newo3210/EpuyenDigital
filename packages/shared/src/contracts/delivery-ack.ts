import { z } from "zod";

// Delivery ACK - Evolution messages.update status mapped to delivery_status

export const deliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "blocked",
  "simulated",
]);

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const deliveryAckSchema = z.object({
  type: z.literal("delivery_ack"),
  instance: z.string().min(1),
  externalId: z.string().min(1),
  deliveryStatus: deliveryStatusSchema,
});

export type DeliveryAck = z.infer<typeof deliveryAckSchema>;

// mapEvolutionAckStatus - Evolution numeric/string status → delivery_status
export function mapEvolutionAckStatus(raw: unknown): DeliveryStatus | null {
  if (raw === 3 || raw === "3" || raw === "READ" || raw === "read") return "read";
  if (raw === 2 || raw === "2" || raw === "DELIVERY_ACK" || raw === "delivered") {
    return "delivered";
  }
  if (raw === 1 || raw === "1" || raw === "SERVER_ACK" || raw === "sent") return "sent";
  if (raw === 0 || raw === "0" || raw === "ERROR" || raw === "failed") return "failed";
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    if (lower === "read" || lower === "played") return "read";
    if (lower === "delivered") return "delivered";
    if (lower === "sent" || lower === "server_ack") return "sent";
    if (lower === "pending" || lower === "pending_ack") return "pending";
    if (lower === "failed" || lower === "error") return "failed";
  }
  return null;
}
