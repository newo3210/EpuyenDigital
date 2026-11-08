// Inbound side effects - when a citizen message should reopen a resolved thread.
export function shouldReopenConversation(input: {
  fromMe: boolean;
  queueColumn: string | null | undefined;
}): boolean {
  return !input.fromMe && input.queueColumn === 'resolved';
}
