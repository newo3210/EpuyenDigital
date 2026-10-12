import {
  evolutionWebhookSchema,
  normalizePhone,
  type EvolutionWebhook,
} from "@epuyen/shared";

// Normalize Evolution - map raw Evolution payload to Zod inbound contract

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
  const key = readString(data, "key") ? asRecord(data.key) : data;
  const remote =
    readString(asRecord(data.key), "remoteJid", "remoteJidAlt") ??
    readString(data, "remoteJid", "from", "sender") ??
    "";
  const alt = readString(data, "senderPn", "remoteJidAlt") ?? "";
  const candidate = remote.includes("@lid") && alt ? alt : remote;
  return candidate.replace(/@.+$/, "");
}

function isGroupJid(jid: string): boolean {
  return jid.includes("@g.us") || jid.includes("@broadcast");
}

// normalizeEvolutionPayload - thin presentation mapping (no I/O)
export function normalizeEvolutionPayload(raw: unknown): {
  ignored: boolean;
  reason?: "group" | "broadcast" | "invalid";
  event?: EvolutionWebhook;
} {
  const envelope = asRecord(raw);
  const data = asRecord(envelope.data ?? envelope);
  const key = asRecord(data.key);
  const remoteJid = readString(key, "remoteJid") ?? readString(data, "remoteJid") ?? "";
  const instance =
    readString(envelope, "instance") ??
    readString(data, "instance") ??
    "inspectoria";

  if (remoteJid.includes("@broadcast") || readString(data, "broadcast") === "true") {
    return { ignored: true, reason: "broadcast" };
  }
  if (isGroupJid(remoteJid)) {
    return { ignored: true, reason: "group" };
  }

  const externalId =
    readString(key, "id") ??
    readString(data, "id", "messageId") ??
    cryptoRandomId();

  const phoneRaw = extractPhoneRaw(data);
  let phoneNormalized: string;
  try {
    phoneNormalized = normalizePhone(phoneRaw);
  } catch {
    return { ignored: true, reason: "invalid" };
  }

  const message = asRecord(data.message ?? data);
  const location = asRecord(message.locationMessage ?? data.locationMessage ?? {});
  const image = asRecord(message.imageMessage ?? data.imageMessage ?? {});
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
  } else if (image.url || image.mediaUrl || data.mediaUrl) {
    kind = "image";
    mediaUrl = String(image.url ?? image.mediaUrl ?? data.mediaUrl);
    mediaMime = String(image.mimetype ?? data.mimetype ?? "image/jpeg");
    text = readString(image, "caption") ?? text;
  } else if (buttonsResponse.selectedButtonId || buttonsResponse.selectedDisplayText) {
    kind = "button_reply";
    buttonId = readString(buttonsResponse, "selectedButtonId");
    text = readString(buttonsResponse, "selectedDisplayText") ?? buttonId;
  } else if (text) {
    kind = "text";
  }

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
    receivedAt: new Date().toISOString(),
  });

  if (!parsed.success) {
    return { ignored: true, reason: "invalid" };
  }
  return { ignored: false, event: parsed.data };
}

function cryptoRandomId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
