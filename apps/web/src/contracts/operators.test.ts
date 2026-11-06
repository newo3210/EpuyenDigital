import { operatorCreateSchema, operatorUpdateSchema } from './operators';

const validCreate = {
  email: 'op@epuyen.gob.ar',
  fullName: 'Ana Pérez',
  role: 'operator' as const,
  temporaryPassword: 'temporal-1234',
  memberships: [{ areaId: '00000000-0000-4000-8000-000000000010', isLead: false }],
};

// Operator create validation - email, name, password length, memberships.
describe('operatorCreateSchema', () => {
  it('accepts a valid create payload', () => {
    expect(operatorCreateSchema.parse(validCreate).email).toBe('op@epuyen.gob.ar');
  });

  it('lowercases email', () => {
    expect(operatorCreateSchema.parse({ ...validCreate, email: 'Op@Epuyen.Gob.Ar' }).email).toBe('op@epuyen.gob.ar');
  });

  it('rejects short temporary passwords', () => {
    expect(operatorCreateSchema.safeParse({ ...validCreate, temporaryPassword: 'short' }).success).toBe(false);
  });
});

// Operator update - email must not be present (immutable after create in v1).
describe('operatorUpdateSchema', () => {
  it('accepts role and memberships without email', () => {
    expect(
      operatorUpdateSchema.parse({
        id: '00000000-0000-4000-8000-0000000000a1',
        role: 'area_lead',
        memberships: [{ areaId: '00000000-0000-4000-8000-000000000011', isLead: true }],
      }).role,
    ).toBe('area_lead');
  });
});
