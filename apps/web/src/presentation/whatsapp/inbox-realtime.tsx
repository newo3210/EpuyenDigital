'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/infrastructure/supabase/browser';
import { esAR } from '@/i18n/es-AR';

type InboxRealtimeProps = {
  orgId: string;
  currentUserId: string;
  /** Areas the operator belongs to — used for area-delegation badge targeting. */
  callerAreaIds?: string[];
};

type ConversationPayload = {
  org_id?: string;
  awaiting_acceptance?: boolean;
  owner_user_id?: string | null;
  pending_area_id?: string | null;
  delegated_from_user_id?: string | null;
};

type MessagePayload = {
  org_id?: string;
  direction?: string;
};

/**
 * InboxRealtimeProvider - postgres_changes → refresh + badge + optional sound.
 *
 * Badge increments only for inbound messages and delegations targeting this
 * operator (user pending or pending_area in caller's areas). Queue refresh
 * still runs on org-scoped conversation changes.
 *
 * Privacy: subscriptions filter by org_id. Correctness still depends on
 * Supabase Realtime RLS being enabled for conversations/messages so JWT
 * area policies apply to change payloads (see adversarial-fixes-round1.md).
 */
export function InboxRealtimeProvider({
  orgId,
  currentUserId,
  callerAreaIds = [],
}: InboxRealtimeProps) {
  const router = useRouter();
  const [badge, setBadge] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const areaIdsRef = useRef(callerAreaIds);
  areaIdsRef.current = callerAreaIds;

  useEffect(() => {
    const stored = window.localStorage.getItem('inbox-sound');
    setSoundEnabled(stored === '1');
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    const maybeSound = () => {
      if (soundEnabled && audioRef.current) {
        void audioRef.current.play().catch(() => undefined);
      }
    };

    const isDelegationToSelf = (row: ConversationPayload) => {
      if (!row.awaiting_acceptance) return false;
      if (row.owner_user_id === currentUserId) return true;
      if (
        row.pending_area_id &&
        areaIdsRef.current.includes(row.pending_area_id)
      ) {
        return true;
      }
      return false;
    };

    const channel = supabase
      .channel(`inbox-org-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `org_id=eq.${orgId}` },
        (payload) => {
          router.refresh();
          const row = (payload.new ?? {}) as ConversationPayload;
          if (isDelegationToSelf(row)) {
            setBadge((n) => n + 1);
            maybeSound();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = (payload.new ?? {}) as MessagePayload;
          if (row.direction !== 'inbound') {
            // Outbound / system chatter: refresh quietly, no badge.
            router.refresh();
            return;
          }
          setBadge((n) => n + 1);
          router.refresh();
          maybeSound();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, currentUserId, router, soundEnabled]);

  return (
    <div className="flex items-center gap-3">
      {badge > 0 ? (
        <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
          {esAR.inbox.badgeNew}: {badge}
        </span>
      ) : null}
      <button
        type="button"
        className="text-xs text-muted underline"
        onClick={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          window.localStorage.setItem('inbox-sound', next ? '1' : '0');
        }}
      >
        {soundEnabled ? esAR.inbox.soundOn : esAR.inbox.soundOff}
      </button>
      {/* Short silent-capable beep data URI; browsers may block until gesture. */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      />
    </div>
  );
}
