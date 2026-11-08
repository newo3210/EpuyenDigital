export type CitizenFieldKey =
  | 'full_name'
  | 'document_id'
  | 'phone'
  | 'address_line'
  | 'neighborhood'
  | 'email';

export type CitizenFieldGaps = {
  required: CitizenFieldKey[];
  optional: CitizenFieldKey[];
};

type GapInput = {
  partyKind: 'person' | 'organization';
  fullName: string | null;
  documentId: string | null;
  phoneCount: number;
  addressLine: string | null;
  neighborhood: string | null;
  email: string | null;
};

function blank(value: string | null): boolean {
  return !value || value.trim() === '';
}

// Missing fields - required set depends on person vs organization.
export function citizenFieldGaps(input: GapInput): CitizenFieldGaps {
  const required: CitizenFieldKey[] = [];
  if (blank(input.fullName)) required.push('full_name');
  if (input.partyKind !== 'organization' && blank(input.documentId)) required.push('document_id');
  if (input.phoneCount < 1) required.push('phone');

  const optional: CitizenFieldKey[] = [];
  if (blank(input.addressLine)) optional.push('address_line');
  if (blank(input.neighborhood)) optional.push('neighborhood');
  if (blank(input.email)) optional.push('email');

  return { required, optional };
}
