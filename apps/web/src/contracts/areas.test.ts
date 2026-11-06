import { areaCreateSchema, areaUpdateSchema } from './areas';

// Area create validation - color, SLA order, name required.
describe('areaCreateSchema', () => {
  const valid = {
    name: 'Obras Públicas',
    color: '#ABCDEF',
    isActive: true,
    isDefault: false,
    slaWarningMinutes: 30,
    slaCriticalMinutes: 120,
  };

  it('accepts a valid create payload', () => {
    expect(areaCreateSchema.parse(valid)).toMatchObject({
      name: 'Obras Públicas',
      color: '#ABCDEF',
      slaWarningMinutes: 30,
      slaCriticalMinutes: 120,
    });
  });

  it('rejects invalid colors', () => {
    expect(areaCreateSchema.safeParse({ ...valid, color: 'blue' }).success).toBe(false);
    expect(areaCreateSchema.safeParse({ ...valid, color: '#ABC' }).success).toBe(false);
  });

  it('rejects critical SLA below warning', () => {
    const result = areaCreateSchema.safeParse({ ...valid, slaWarningMinutes: 60, slaCriticalMinutes: 30 });
    expect(result.success).toBe(false);
  });

  it('trims blank description to undefined', () => {
    expect(areaCreateSchema.parse({ ...valid, description: '   ' }).description).toBeUndefined();
  });
});

// Area update validation - requires id.
describe('areaUpdateSchema', () => {
  it('requires a uuid id', () => {
    expect(
      areaUpdateSchema.safeParse({
        name: 'Mesa',
        color: '#1B4F72',
        isActive: true,
        isDefault: true,
      }).success,
    ).toBe(false);
  });
});
