'use client';

import { useEffect, useRef, useState } from 'react';
import { esAR } from '@/i18n/es-AR';

const STORAGE_KEY = 'inbox-sound';

type InboxSoundProps = {
  count: number;
};

// Optional beep - stays off until the operator turns it on in this browser.
export function InboxSound({ count }: InboxSoundProps) {
  const previous = useRef(count);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'on');
  }, []);

  useEffect(() => {
    if (enabled && count > previous.current) {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 880;
      oscillator.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      void oscillator.onended;
    }
    previous.current = count;
  }, [count, enabled]);

  return (
    <button
      type="button"
      className="text-xs text-muted underline"
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      }}
    >
      {enabled ? esAR.inbox.soundOff : esAR.inbox.soundOn}
    </button>
  );
}
