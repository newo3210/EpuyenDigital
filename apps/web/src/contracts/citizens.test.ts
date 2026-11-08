import { citizenProfileInputSchema, mergeCitizensInputSchema } from './citizens';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('citizenProfileInputSchema', () => {
  it('accepts a person with a home coordinate', () => {
    const parsed = citizenProfileInputSchema.parse({
      id,
      fullName: 'Ana',
      documentId: '30111222',
      partyKind: 'person',
      latitude: '-42.1',
      longitude: '-71.4',
    });
    expect(parsed.latitude).toBeCloseTo(-42.1);
    expect(parsed.partyKind).toBe('person');
  });

  it('rejects a latitude outside the range', () => {
    const parsed = citizenProfileInputSchema.safeParse({
      id,
      partyKind: 'organization',
      latitude: '120',
      longitude: '0',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('mergeCitizensInputSchema', () => {
  it('rejects merging a record into itself', () => {
    const parsed = mergeCitizensInputSchema.safeParse({ keepId: id, dropId: id, note: 'mismo' });
    expect(parsed.success).toBe(false);
  });

  it('accepts two ids and a note', () => {
    const parsed = mergeCitizensInputSchema.parse({ keepId: id, dropId: other, note: 'duplicado' });
    expect(parsed.dropId).toBe(other);
  });
});
