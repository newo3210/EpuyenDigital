'use client';

import { useActionState, type ReactNode } from 'react';

type InboxActionState = { status?: 'ok' | 'error'; message?: string };

type ActionFormProps = {
  action: (previous: InboxActionState, formData: FormData) => Promise<InboxActionState>;
  className?: string;
  children: ReactNode;
};

// Action form - shows the SQL hint in Spanish when a transition fails.
export function ActionForm({ action, className, children }: ActionFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      {children}
      {state.status === 'error' && state.message ? (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
