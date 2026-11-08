import { render, screen } from '@testing-library/react';
import type { ConversationThread } from '@/contracts/conversations';
import type { QueueCard } from '@/contracts/inbox';
import { QueueBoard } from './queue-board';
import { ThreadView } from './thread-view';

vi.mock('@/features/inbox/actions', () => ({
  acceptDelegationAction: vi.fn(),
  claimConversationAction: vi.fn(),
  delegateConversationAction: vi.fn(),
  moveConversationAction: vi.fn(),
  rejectDelegationAction: vi.fn(),
  resolveConversationAction: vi.fn(),
  setConversationAreaAction: vi.fn(),
}));

vi.mock('@/features/outbound/actions', () => ({
  sendComposerTextAction: vi.fn(),
}));

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

function card(overrides: Partial<QueueCard> = {}): QueueCard {
  return {
    id,
    phoneNormalized: '5492944000000',
    areaId: other,
    areaName: 'Mesa de Entrada',
    lineId: other,
    ownerUserId: null,
    ownerName: null,
    queueColumn: 'new',
    botState: 'active',
    needsResponse: true,
    awaitingAcceptance: false,
    hasAttachments: true,
    lastMessageAt: '2026-11-09T11:00:00.000Z',
    lastMessagePreview: 'Hola',
    slaLevel: 'hidden',
    registrationStatus: 'unregistered',
    citizenPushName: null,
    unread: true,
    ...overrides,
  };
}

function thread(): ConversationThread {
  return {
    conversation: {
      id,
      orgId: other,
      lineId: other,
      phoneNormalized: '5492944000000',
      areaId: other,
      lastMessageAt: '2026-11-09T11:00:00.000Z',
      needsResponse: true,
      citizenId: other,
    },
    citizen: { latitude: -42.1, longitude: -71.5, registrationStatus: 'unregistered' },
    messages: [
      {
        id,
        direction: 'inbound',
        kind: 'image',
        body: 'foto',
        deliveryStatus: null,
        createdAt: '2026-11-09T11:00:00.000Z',
        latitude: -42.2,
        longitude: -71.6,
        storagePath: 'org/a.jpg',
        mediaHref: 'https://example.test/a.jpg',
      },
      {
        id: other,
        direction: 'outbound',
        kind: 'text',
        body: 'recibido',
        deliveryStatus: 'read',
        createdAt: '2026-11-09T11:05:00.000Z',
        readAt: '2026-11-09T11:06:00.000Z',
      },
    ],
  };
}

// Queue labels - unregistered and attachments stay as text, hidden SLA has no badge.
describe('QueueBoard', () => {
  it('shows unregistered and attachment labels and hides SLA when the area has no clock', () => {
    render(<QueueBoard cards={[card()]} />);

    expect(screen.getByText('No registrado')).toBeInTheDocument();
    expect(screen.getByText('Tiene adjuntos')).toBeInTheDocument();
    expect(screen.queryByText('SLA crítico')).not.toBeInTheDocument();
    expect(screen.queryByText('SLA en aviso')).not.toBeInTheDocument();
  });
});

// Thread labels - inquiry and home stay separate; ticks only on outbound; support has no claim button.
describe('ThreadView', () => {
  it('shows both coordinate labels, the image, and a read tick', () => {
    render(
      <ThreadView
        thread={thread()}
        events={[]}
        quickReplies={[]}
        operators={[]}
        areas={[]}
        canMutate
      />,
    );

    expect(screen.getByRole('link', { name: /Consulta/ })).toHaveAttribute('href', expect.stringContaining('mlat=-42.2'));
    expect(screen.getByRole('link', { name: /Domicilio \/ mascota/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mlat=-42.1'),
    );
    expect(screen.getByRole('img', { name: 'image' })).toHaveAttribute('src', 'https://example.test/a.jpg');
    expect(screen.getByText(/Leído/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', `/citizens/${other}`);
  });

  it('hides mutating controls for support', () => {
    render(
      <ThreadView
        thread={thread()}
        events={[]}
        quickReplies={[]}
        operators={[]}
        areas={[]}
        canMutate={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Tomar' })).not.toBeInTheDocument();
  });
});
