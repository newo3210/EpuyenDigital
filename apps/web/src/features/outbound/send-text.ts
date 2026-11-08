import { decideSend, normalizePhone, composerTextSchema, type SendMode } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.inbox.composer.errors;

export type SendTextDeps = {
  authorUserId: string;
  ensureOwner: (conversationId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  loadConversation: (conversationId: string) => Promise<{
    id: string;
    orgId: string;
    lineId: string;
    phoneNormalized: string;
  } | null>;
  loadOrgSendMode: (orgId: string) => Promise<{
    sendMode: SendMode;
    allowlistPhones: string[];
  }>;
  loadLineCredentials: (lineId: string) => Promise<{
    apiKey: string | null;
    baseUrl: string | null;
    instance: string;
  }>;
  persistOutbound: (params: {
    orgId: string;
    lineId: string;
    conversationId: string;
    phone: string;
    text: string;
    authorUserId: string;
    deliveryStatus: 'pending' | 'sent' | 'simulated' | 'blocked' | 'failed';
    externalId?: string;
  }) => Promise<{ messageId: string }>;
  updateOutbound: (params: {
    messageId: string;
    deliveryStatus: 'sent' | 'failed';
    externalId?: string;
  }) => Promise<void>;
  sendViaEvolution: (params: {
    baseUrl: string;
    apiKey: string;
    instance: string;
    phone: string;
    text: string;
  }) => Promise<{ externalId: string }>;
};

export type SendTextResult =
  | { status: 'ok'; messageId: string; deliveryStatus: string; dryRun: boolean }
  | { status: 'invalid'; fieldErrors: Partial<Record<'conversationId' | 'text', string>> }
  | { status: 'failed'; message: string };

// sendOperatorText - composer use case with shared send_mode guard + phone normalize.
// Production path: persist pending → Evolution → update sent/failed (never send-before-persist).
export async function sendOperatorText(
  input: unknown,
  deps: SendTextDeps,
): Promise<SendTextResult> {
  const parsed = composerTextSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        conversationId: flat.conversationId?.[0] ?? messages.conversationRequired,
        text: flat.text?.[0] ?? messages.emptyBody,
      },
    };
  }

  const conversation = await deps.loadConversation(parsed.data.conversationId);
  if (!conversation) {
    return { status: 'failed', message: messages.conversationNotFound };
  }

  const ownership = await deps.ensureOwner(conversation.id);
  if (!ownership.ok) {
    return { status: 'failed', message: ownership.message };
  }

  let phone: string;
  try {
    phone = normalizePhone(conversation.phoneNormalized);
  } catch {
    return { status: 'failed', message: messages.invalidPhone };
  }

  const settings = await deps.loadOrgSendMode(conversation.orgId);
  const decision = decideSend({
    mode: settings.sendMode,
    phone,
    allowlist: settings.allowlistPhones,
  });

  if (!decision.allowed) {
    const deliveryStatus = decision.reason === 'dry_run' ? 'simulated' : 'blocked';
    const persisted = await deps.persistOutbound({
      orgId: conversation.orgId,
      lineId: conversation.lineId,
      conversationId: conversation.id,
      phone,
      text: parsed.data.text,
      authorUserId: deps.authorUserId,
      deliveryStatus,
      externalId: `local-${crypto.randomUUID()}`,
    });
    return {
      status: 'ok',
      messageId: persisted.messageId,
      deliveryStatus,
      dryRun: decision.reason === 'dry_run',
    };
  }

  const creds = await deps.loadLineCredentials(conversation.lineId);
  if (!creds.baseUrl || !creds.apiKey) {
    return { status: 'failed', message: messages.missingLineCredentials };
  }

  const pending = await deps.persistOutbound({
    orgId: conversation.orgId,
    lineId: conversation.lineId,
    conversationId: conversation.id,
    phone,
    text: parsed.data.text,
    authorUserId: deps.authorUserId,
    deliveryStatus: 'pending',
    externalId: `pending-${crypto.randomUUID()}`,
  });

  try {
    const sent = await deps.sendViaEvolution({
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      instance: creds.instance,
      phone,
      text: parsed.data.text,
    });
    await deps.updateOutbound({
      messageId: pending.messageId,
      deliveryStatus: 'sent',
      externalId: sent.externalId,
    });
    return {
      status: 'ok',
      messageId: pending.messageId,
      deliveryStatus: 'sent',
      dryRun: false,
    };
  } catch {
    await deps.updateOutbound({
      messageId: pending.messageId,
      deliveryStatus: 'failed',
    });
    return { status: 'failed', message: messages.sendFailed };
  }
}
