'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/infrastructure/supabase/browser';
import { esAR } from '@/i18n/es-AR';

type InboxRealtimeProps = {
  orgId: string;
  currentUserId: string;
};

// InboxRealtimeProvider - postgres_changes → refresh + badge + optional sound.
export function InboxRealtimeProvider({ orgId, currentUserId }: InboxRealtimeProps) {
  const router = useRouter();
  const [badge, setBadge] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('inbox-sound');
    setSoundEnabled(stored === '1');
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`inbox-org-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `org_id=eq.${orgId}` },
        (payload) => {
          setBadge((n) => n + 1);
          router.refresh();
          const row = (payload.new ?? {}) as {
            awaiting_acceptance?: boolean;
            owner_user_id?: string | null;
          };
          if (
            soundEnabled &&
            row.awaiting_acceptance &&
            row.owner_user_id === currentUserId &&
            audioRef.current
          ) {
            void audioRef.current.play().catch(() => undefined);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          setBadge((n) => n + 1);
          router.refresh();
          if (soundEnabled && audioRef.current) {
            void audioRef.current.play().catch(() => undefined);
          }
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
