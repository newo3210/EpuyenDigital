import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// external_notify - WhatsApp protocol text for an external municipal contact.

export async function handleExternalNotify(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "external_notify") {
    throw new Error("WRONG_JOB_TYPE");
  }

  const task = await ctx.store.getExternalTaskNotify(payload.taskId);
  if (!task) throw new Error("TASK_NOT_FOUND");
  if (!task.externalPhone || !task.lineId) {
    throw new Error("EXTERNAL_TARGET_MISSING");
  }

  const text = [
    `Nueva tarea municipal ${task.publicRef}: ${task.title}`,
    "Respondé con uno de estos comandos:",
    `ACEPTO ${task.publicRef}`,
    `RECHAZO ${task.publicRef} motivo`,
    `LISTO ${task.publicRef} detalle`,
    `NO SE PUEDE ${task.publicRef} motivo`,
  ].join("\n");

  await ctx.store.enqueueJob(payload.orgId, {
    type: "send_outbound",
    lineId: task.lineId,
    phone: task.externalPhone,
    text,
  });
}
