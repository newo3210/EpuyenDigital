// Foundation + pet registry Zod contract tests (reconciled)

import { describe, expect, it } from 'vitest';
import {
  ERROR_LEVELS,
  ERROR_SOURCES,
  ERROR_STATUSES,
  ROLES,
  animalDraftSchema,
  citizenUpsertSchema,
  errorLogSchema,
  evolutionWebhookSchema,
  fullNameSchema,
  jobPayloadSchema,
  outboundTextSchema,
  profileSchema,
  registrationSessionSchema,
  roleSchema,
  visionTraitsSchema,
} from './index.js';

// Valid fixtures - samples shaped like repository output (camelCase domain objects).
const ORG_ID = '7d3c1f9e-2b4a-4c8d-9e1f-0a2b3c4d5e6f';
const USER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const validProfile = {
  id: USER_ID,
  orgId: ORG_ID,
  fullName: 'Ana Pérez',
  avatarPath: null,
  role: 'operator',
  isActive: true,
};

const validErrorLog = {
  id: '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
  orgId: ORG_ID,
  source: 'web',
  level: 'error',
  message: 'Render failed',
  details: { url: '/inbox' },
  traceId: '550e8400-e29b-41d4-a716-446655440000',
  userId: USER_ID,
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-10-01T12:00:00.123456+00:00',
};

// Roles - closed set matching the user_role enum.
describe('roleSchema', () => {
  it('accepts every declared role', () => {
    expect(ROLES).toEqual(['admin', 'area_lead', 'operator', 'support']);
    for (const role of ROLES) expect(roleSchema.parse(role)).toBe(role);
  });

  it.each(['superadmin', 'Admin', ''])('rejects "%s"', (role) => {
    expect(roleSchema.safeParse(role).success).toBe(false);
  });
});

// Full name - trimmed, 2 to 80 characters.
describe('fullNameSchema', () => {
  it('trims surrounding spaces', () => {
    expect(fullNameSchema.parse('  Ana Pérez  ')).toBe('Ana Pérez');
  });

  it.each([
    ['too short after trim', ' A '],
    ['too long', 'a'.repeat(81)],
  ])('rejects a name that is %s', (_label, value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(false);
  });

  it('accepts the 2 and 80 character bounds', () => {
    expect(fullNameSchema.safeParse('Al').success).toBe(true);
    expect(fullNameSchema.safeParse('a'.repeat(80)).success).toBe(true);
  });

  it.each([
    ['Hangul fillers', '\u3164\u3164'],
    ['choseong/halfwidth/jungseong fillers', '\u115f\uffa0\u1160'],
    ['LRM/RLM/ALM marks', '\u200e\u200f\u061c'],
    ['soft hyphens', '\u00ad\u00ad'],
    ['combining marks', '\u0301\u0301\u0301'],
    ['a Hangul filler as the only letter', '\u0301\u3164\u0301'],
    ['braille blanks and bidi isolates', '\u2800\u2800\u2066\u2069'],
    ['tag characters and a variation selector', '\u{e0061}\u{e0062}\ufe0f'],
    ['zero-width spaces around one letter', '\u200bA\u200b'],
  ])('rejects a visually blank name made of %s', (_label, value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(false);
  });

  it.each(['José Pérez', '李明', '\tAna\u00a0María\u200b'])('accepts the visible name %j', (value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(true);
  });

  it('counts code points, not UTF-16 units, like the database', () => {
    expect(fullNameSchema.safeParse(`Ana ${'\u{1f600}'.repeat(40)}`).success).toBe(true);
    expect(fullNameSchema.safeParse('\u{1d400}'.repeat(80)).success).toBe(true);
    expect(fullNameSchema.safeParse('\u{1d400}'.repeat(81)).success).toBe(false);
  });

  it.each([
    ['vulgar fractions (not letters or decimal digits)', '\u00bd\u00bd'],
    ['a letter followed by an ICU-only blank', 'A\u001c'],
    ['a letter followed by NEL', 'A\u0085'],
    ['a letter and a supplementary variation selector', 'A\u{e0100}'],
    ['a letter and Mongolian free variation selectors', 'A\u180b\u180f'],
    ['a letter and Khmer inherent vowels', 'A\u17b4\u17b5'],
    ['a letter and reserved/shorthand/musical format controls', 'A\ufff0\u{1bca0}\u{1d173}'],
    ['a short name padded beyond 80 raw code points with zero-width spaces', `Ana${'\u200b'.repeat(78)}`],
  ])('rejects %s like the database', (_label, value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(false);
  });
});

// Profile - operator identity within an organization.
describe('profileSchema', () => {
  it('accepts a valid profile with and without avatar', () => {
    expect(profileSchema.parse(validProfile)).toEqual(validProfile);
    const withAvatar = { ...validProfile, avatarPath: `${ORG_ID}/${USER_ID}/a.png` };
    expect(profileSchema.parse(withAvatar)).toEqual(withAvatar);
  });

  it.each([`Ana ${'\u{1f600}'.repeat(40)}`, '\u{1d400}'.repeat(41)])(
    'reads any name the database accepted (%#), so an operator is never locked out',
    (fullName) => {
      expect(profileSchema.safeParse({ ...validProfile, fullName }).success).toBe(true);
    },
  );

  it.each([
    ['non-uuid id', { id: 'abc' }],
    ['missing orgId', { orgId: undefined }],
    ['unknown role', { role: 'root' }],
    ['non-boolean isActive', { isActive: 'yes' }],
    ['empty name', { fullName: '' }],
  ])('rejects a profile with %s', (_label, patch) => {
    expect(profileSchema.safeParse({ ...validProfile, ...patch }).success).toBe(false);
  });
});

// Error log - row shape for the support screen.
describe('errorLogSchema', () => {
  it('declares the enum values from the design', () => {
    expect(ERROR_SOURCES).toEqual(['web', 'api', 'worker', 'db']);
    expect(ERROR_LEVELS).toEqual(['error', 'warn', 'info']);
    expect(ERROR_STATUSES).toEqual(['open', 'acknowledged', 'resolved']);
  });

  it('accepts an open error and a resolved error with null org', () => {
    expect(errorLogSchema.parse(validErrorLog)).toEqual(validErrorLog);
    const resolved = {
      ...validErrorLog,
      orgId: null,
      userId: null,
      status: 'resolved',
      resolvedBy: USER_ID,
      resolvedAt: '2026-10-01T13:00:00+00:00',
    };
    expect(errorLogSchema.parse(resolved)).toEqual(resolved);
  });

  it.each([
    ['unknown source', { source: 'webhook' }],
    ['unknown level', { level: 'fatal' }],
    ['unknown status', { status: 'closed' }],
    ['non-object details', { details: 'oops' }],
    ['invalid timestamp', { createdAt: 'yesterday' }],
    ['short trace id', { traceId: 'abc' }],
  ])('rejects an error log with %s', (_label, patch) => {
    expect(errorLogSchema.safeParse({ ...validErrorLog, ...patch }).success).toBe(false);
  });
});

describe("Pet registry Zod contracts", () => {
  it("accepts normalized webhook", () => {
    const parsed = evolutionWebhookSchema.parse({
      externalId: "wamid.1",
      instance: "inspectoria",
      phoneRaw: "+54 9 2944 216586",
      phoneNormalized: "5492944216586",
      kind: "text",
      text: "hola",
    });
    expect(parsed.kind).toBe("text");
  });

  it("validates registration session and citizen/animal drafts", () => {
    expect(() =>
      registrationSessionSchema.parse({
        orgId: "00000000-0000-4000-8000-000000000001",
        lineId: "00000000-0000-4000-8000-000000000002",
        phoneNormalized: "5492944216586",
        step: "welcome",
        expiresAt: new Date().toISOString(),
      }),
    ).not.toThrow();

    expect(
      citizenUpsertSchema.parse({
        fullName: "Ana",
        documentId: "30111222",
        addressLine: "Calle 1",
        phoneNormalized: "5491111111111",
      }).fullName,
    ).toBe("Ana");

    expect(
      citizenUpsertSchema.parse({
        fullName: "Ana",
        documentId: "30111222",
        addressLine: "Calle 1",
        neighborhood: null,
        latitude: null,
        longitude: null,
        privacyConsentAt: null,
        phoneNormalized: "5491111111111",
      }).latitude,
    ).toBeNull();

    expect(
      animalDraftSchema.parse({
        name: "Luna",
        species: "dog",
        sex: "female",
        breedColor: "mestiza negra",
        size: "medium",
        ageStage: "adulto",
        sterilized: "yes",
        rabiesStatus: "unknown",
      }).rabiesStatus,
    ).toBe("unknown");
  });

  it("validates vision traits and outbound/job payloads", () => {
    expect(
      visionTraitsSchema.parse({
        summary: "Perro negro",
        colors: ["negro"],
        markings: [],
        notableFeatures: ["orejas caídas"],
      }).summary,
    ).toBe("Perro negro");

    expect(
      outboundTextSchema.parse({
        phone: "5492944216586",
        text: "Hola",
        lineId: "00000000-0000-4000-8000-000000000002",
      }).phone,
    ).toBe("5492944216586");

    expect(
      jobPayloadSchema.parse({
        type: "process_inbound",
        messageId: "00000000-0000-4000-8000-000000000003",
        lineId: "00000000-0000-4000-8000-000000000002",
        orgId: "00000000-0000-4000-8000-000000000001",
      }).type,
    ).toBe("process_inbound");
  });

  it("rejects horse species", () => {
    expect(() =>
      animalDraftSchema.parse({
        name: "Rocinante",
        species: "horse",
        sex: "male",
        breedColor: "alazan",
        size: "large",
        ageStage: "adulto",
        sterilized: "no",
        rabiesStatus: "pending",
      }),
    ).toThrow();
  });
});
