// Map PostgREST / RPC errors to typed inbox ownership outcomes.

export type OwnershipErrorCode =
  | 'CLAIM_CONFLICT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN';

export type OwnershipError = {
  code: OwnershipErrorCode;
  message: string;
  ownerUserId?: string;
};

function detailOf(error: { message?: string; details?: string; hint?: string }): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(' ');
}

// mapRpcError - CLAIM_CONFLICT and owned_by:<uuid> detail parsing.
export function mapRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): OwnershipError {
  const blob = detailOf(error);
  if (/CLAIM_CONFLICT/i.test(blob) || /owned_by:/i.test(blob)) {
    const owned = /owned_by:([0-9a-f-]{36})/i.exec(blob);
    return {
      code: 'CLAIM_CONFLICT',
      message: blob,
      ownerUserId: owned?.[1],
    };
  }
  if (/NOT_FOUND|conversation_not_found/i.test(blob)) {
    return { code: 'NOT_FOUND', message: blob };
  }
  if (/forbidden|AREA_FORBIDDEN|NOT_AUTHENTICATED|ROLE_FORBIDDEN/i.test(blob)) {
    return { code: 'FORBIDDEN', message: blob };
  }
  if (/invalid_state|RESOLVED|NOT_AWAITING|ALREADY_AWAITING/i.test(blob)) {
    return { code: 'INVALID_STATE', message: blob };
  }
  if (/invalid_argument|NOTE_REQUIRED|TARGET_XOR|22023/i.test(blob)) {
    return { code: 'INVALID_ARGUMENT', message: blob };
  }
  return { code: 'UNKNOWN', message: blob || 'RPC failed' };
}
