import { citizenFieldGaps } from './missing-fields';

describe('citizenFieldGaps', () => {
  it('lists only the DNI when a person already has a name and a phone', () => {
    const gaps = citizenFieldGaps({
      partyKind: 'person',
      fullName: 'Ana',
      documentId: null,
      phoneCount: 1,
      addressLine: null,
      neighborhood: 'Centro',
      email: null,
    });
    expect(gaps.required).toEqual(['document_id']);
    expect(gaps.optional).toEqual(['address_line', 'email']);
  });

  it('does not require a DNI for an organization', () => {
    const gaps = citizenFieldGaps({
      partyKind: 'organization',
      fullName: 'Escuela',
      documentId: null,
      phoneCount: 1,
      addressLine: 'Ruta 40',
      neighborhood: 'Centro',
      email: 'escuela@example.test',
    });
    expect(gaps.required).toEqual([]);
    expect(gaps.optional).toEqual([]);
  });
});
