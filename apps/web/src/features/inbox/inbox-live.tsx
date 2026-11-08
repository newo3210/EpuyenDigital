'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/infrastructure/supabase/browser';

type InboxLiveProps = {
  enabled?: boolean;
};

// Live inbox - refresh server data when conversations or messages change. No full reload.
export function InboxLive({ enabled = true }: InboxLiveProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel('inbox-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return null;
}
