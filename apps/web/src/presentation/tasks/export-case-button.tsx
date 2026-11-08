'use client';

import { useActionState, useEffect } from 'react';
import { exportCaseAction, type TaskActionState } from '@/features/tasks/actions';
import { esAR } from '@/i18n/es-AR';

type ExportCaseButtonProps = {
  conversationId: string;
};

// Export case - downloads JSON when the SQL payload returns.
export function ExportCaseButton({ conversationId }: ExportCaseButtonProps) {
  const [state, formAction] = useActionState(exportCaseAction, {} as TaskActionState);

  useEffect(() => {
    if (state.status !== 'ok' || !state.payload) return;
    const blob = new Blob([JSON.stringify(state.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `caso-${conversationId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [conversationId, state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <button type="submit" className="rounded border border-line px-3 py-1.5 text-sm">
        {esAR.tasks.export}
      </button>
      {state.status === 'error' && state.message ? (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
