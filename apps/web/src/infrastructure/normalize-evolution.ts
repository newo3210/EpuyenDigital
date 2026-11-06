import {
  deliveryAckSchema,
  evolutionWebhookSchema,
  mapEvolutionAckStatus,
  normalizePhone,
  type DeliveryAck,
  type EvolutionWebhook,
} from "@epuyen/shared";

// Normalize Evolution - map raw Evolution payload to inbound / delivery-ack contracts

type RawData = Record<string, unknown>;

function asRecord(value: unknown): RawData {
  return value && typeof value === "object" ? (value as RawData) : {};
}

function readString(obj: RawData, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function extractPhoneRaw(data: RawData): string {
  const key = asRecord(data.key);
  const remote =
    readString(key, "remoteJid", "remoteJidAlt") ??
    readString(data, "remoteJid", "from", "sender") ??
    "";
  // @lid resolution - prefer real phone JID when Evolution supplies it
  const alt =
    readString(key, "remoteJidAlt", "participant") ??
    readString(data, "senderPn", "remoteJidAlt", "participant", "cleanedSender") ??
    "";
  const candidate =
    (remote.includes("@lid") || remote.includes("@Lid")) && alt ? alt : remote;
  return candidate.replace(/@.+$/, "");
}

function isGroupJid(jid: string): boolean {
  return jid.includes("@g.us");
}

function isBroadcastOrNewsletter(jid: string, data: RawData): boolean {
  if (jid.includes("@broadcast") || jid.includes("@newsletter")) return true;
  if (readString(data, "broadcast") === "true") return true;
  const newsletter = readString(data, "newsletterInviteLink") ?? readString(data, "newsletter");
  return Boolean(newsletter);
}

function readMediaUrl(source: RawData, fallback?: RawData): string | undefined {
  const url =
    readString(source, "url", "mediaUrl") ??
    (fallback ? readString(fallback, "mediaUrl", "url") : undefined);
  return url;
}

// normalizeEvolutionPayload - thin presentation mapping (no I/O)
export function normalizeEvolutionPayload(raw: unknown): {
  ignored: boolean;
  reason?: "group" | "broadcast" | "newsletter" | "invalid" | "not_message";
  event?: EvolutionWebhook;
  deliveryAck?: DeliveryAck;
} {
  const envelope = asRecord(raw);
  const eventName = (readString(envelope, "event") ?? "").toLowerCase();
  const data = asRecord(envelope.data ?? envelope);
  const key = asRecord(data.key);
  const remoteJid = readString(key, "remoteJid") ?? readString(data, "remoteJid") ?? "";
  const instance =
    readString(envelope, "instance") ??
    readString(data, "instance") ??
    "inspectoria";

  // Delivery / read ACK — only messages.update (or status-only envelopes without message body)
  const isUpdateEvent =
    eventName.includes("messages.update") ||
    eventName.includes("message.update") ||
    eventName.includes("messages_update");
  const hasMessageBody =
    Boolean(data.message) ||
    Boolean(readString(data, "body", "text", "conversation"));
  if (isUpdateEvent || (data.ack != null && !hasMessageBody)) {
    const externalId =
      readString(key, "id") ??
      readString(data, "id", "messageId", "keyId") ??
      readString(asRecord(data.messageId), "id");
    const mapped = mapEvolutionAckStatus(data.status ?? data.ack ?? data.messageStatus);
    if (externalId && mapped) {
      const parsed = deliveryAckSchema.safeParse({
        type: "delivery_ack",
        instance,
        externalId,
        deliveryStatus: mapped,
      });
      if (parsed.success) {
        return { ignored: false, deliveryAck: parsed.data };
      }
    }
    if (isUpdateEvent && !hasMessageBody) {
      return { ignored: true, reason: "not_message" };
    }
  }

  if (isBroadcastOrNewsletter(remoteJid, data)) {
    return {
      ignored: true,
      reason: remoteJid.includes("@newsletter") ? "newsletter" : "broadcast",
    };
  }
  if (isGroupJid(remoteJid)) {
    return { ignored: true, reason: "group" };
  }

  // Never invent external ids — missing Evolution key.id breaks idempotency
  const externalId = readString(key, "id") ?? readString(data, "id", "messageId");
  if (!externalId) {
    return { ignored: true, reason: "invalid" };
  }

  // Unresolved @lid without alternate phone cannot be stored safely
  const phoneRaw = extractPhoneRaw(data);
  if (!phoneRaw || remoteJid.includes("@lid") && phoneRaw === remoteJid.replace(/@.+$/, "")) {
    // phoneRaw equals lid digits when alt missing
    if (remoteJid.includes("@lid") && !readString(key, "remoteJidAlt") && !readString(data, "senderPn")) {
      return { ignored: true, reason: "invalid" };
    }
  }

  let phoneNormalized: string;
  try {
    phoneNormalized = normalizePhone(phoneRaw);
  } catch {
    return { ignored: true, reason: "invalid" };
  }

  const message = asRecord(data.message ?? data);
  const location = asRecord(message.locationMessage ?? data.locationMessage ?? {});
  const image = asRecord(message.imageMessage ?? data.imageMessage ?? {});
  const audio = asRecord(message.audioMessage ?? data.audioMessage ?? {});
  const video = asRecord(message.videoMessage ?? data.videoMessage ?? {});
  const document = asRecord(message.documentMessage ?? data.documentMessage ?? {});
  const sticker = asRecord(message.stickerMessage ?? data.stickerMessage ?? {});
  const buttonsResponse = asRecord(
    message.buttonsResponseMessage ?? data.buttonsResponseMessage ?? {},
  );
  const conversation =
    readString(message, "conversation") ??
    readString(asRecord(message.extendedTextMessage), "text") ??
    readString(data, "body", "text");

  let kind: EvolutionWebhook["kind"] = "unknown";
  let text = conversation;
  let mediaUrl: string | undefined;
  let mediaMime: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let buttonId: string | undefined;

  if (location.degreesLatitude != null || data.latitude != null) {
    kind = "location";
    latitude = Number(location.degreesLatitude ?? data.latitude);
    longitude = Number(location.degreesLongitude ?? data.longitude);
  } else if (readMediaUrl(image, data) || image.mimetype) {
    kind = "image";
    mediaUrl = readMediaUrl(image, data);
    mediaMime = String(image.mimetype ?? data.mimetype ?? "image/jpeg");
    text = readString(image, "caption") ?? text;
  } else if (readMediaUrl(audio, data) || audio.mimetype) {
    kind = "audio";
    mediaUrl = readMediaUrl(audio, data);
    mediaMime = String(audio.mimetype ?? data.mimetype ?? "audio/ogg");
  } else if (readMediaUrl(video, data) || video.mimetype) {
    kind = "video";
    mediaUrl = readMediaUrl(video, data);
    mediaMime = String(video.mimetype ?? data.mimetype ?? "video/mp4");
    text = readString(video, "caption") ?? text;
  } else if (readMediaUrl(document, data) || document.mimetype) {
    kind = "document";
    mediaUrl = readMediaUrl(document, data);
    mediaMime = String(document.mimetype ?? data.mimetype ?? "application/octet-stream");
    text = readString(document, "fileName", "title", "caption") ?? text;
  } else if (readMediaUrl(sticker, data) || sticker.mimetype) {
    kind = "sticker";
    mediaUrl = readMediaUrl(sticker, data);
    mediaMime = String(sticker.mimetype ?? data.mimetype ?? "image/webp");
  } else if (buttonsResponse.selectedButtonId || buttonsResponse.selectedDisplayText) {
    kind = "button_reply";
    buttonId = readString(buttonsResponse, "selectedButtonId");
    text = readString(buttonsResponse, "selectedDisplayText") ?? buttonId;
  } else if (text) {
    kind = "text";
  }

  const avatarUrl =
    readString(data, "profilePicUrl", "profilePictureUrl", "avatarUrl") ??
    readString(envelope, "profilePicUrl");

  const parsed = evolutionWebhookSchema.safeParse({
    externalId,
    instance,
    phoneRaw,
    phoneNormalized,
    isGroup: false,
    isBroadcast: false,
    fromMe: Boolean(key.fromMe ?? data.fromMe ?? false),
    kind,
    text,
    mediaUrl,
    mediaMime,
    latitude,
    longitude,
    buttonId,
    pushName: readString(data, "pushName"),
    avatarUrl,
    receivedAt: new Date().toISOString(),
  });

  if (!parsed.success) {
    return { ignored: true, reason: "invalid" };
  }
  return { ignored: false, event: parsed.data };
}
