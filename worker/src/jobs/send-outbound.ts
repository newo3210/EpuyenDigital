import { jobPayloadSchema } from "@epuyen/shared";
import { decideSend } from "../infrastructure/send-mode.js";
import type { JobContext } from "./types.js";

// send_outbound - send-mode guard then Evolution text/buttons/image

export async function handleSendOutbound(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "send_outbound") {
    throw new Error("WRONG_JOB_TYPE");
  }

  const line = await ctx.store.getLineInstance(payload.lineId);
  if (!line) throw new Error("LINE_NOT_FOUND");

  const settings = await ctx.store.getOrgSettings(line.orgId);
  const mode = settings.sendMode ?? ctx.defaultSendMode;
  const allowlist = settings.allowlistPhones.length
    ? settings.allowlistPhones
    : ctx.defaultAllowlist;

  const decision = decideSend({
    mode,
    phone: payload.phone,
    allowlist,
  });

  if (!decision.allowed) {
    await ctx.store.persistOutbound({
      orgId: line.orgId,
      lineId: payload.lineId,
      phone: payload.phone,
      text: payload.mediaPath
        ? `[media:${payload.mediaPath}] ${payload.text}`
        : payload.text,
      deliveryStatus: decision.reason === "dry_run" ? "simulated" : "blocked",
    });
    return;
  }

  let externalId: string;
  if (payload.mediaPath) {
    const sent = await ctx.evolution.sendImage({
      instance: line.instance,
      phone: payload.phone,
      mediaPath: payload.mediaPath,
      caption: payload.text,
    });
    externalId = sent.externalId;
  } else {
    const sent = await ctx.evolution.sendText({
      instance: line.instance,
      phone: payload.phone,
      text: payload.text,
      buttons: payload.buttons,
    });
    externalId = sent.externalId;
  }

  await ctx.store.persistOutbound({
    orgId: line.orgId,
    lineId: payload.lineId,
    phone: payload.phone,
    text: payload.mediaPath
      ? `[media:${payload.mediaPath}] ${payload.text}`
      : payload.text,
    deliveryStatus: "sent",
    externalId,
  });
}
