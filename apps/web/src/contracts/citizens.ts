import { z } from 'zod';

export const partyKindSchema = z.enum(['person', 'organization']);

export type PartyKind = z.infer<typeof partyKindSchema>;

function optionalCoord(min: number, max: number) {
  return z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? '')
    .refine((value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max), {
      message: 'INVALID_FIELD',
    })
    .transform((value) => (value === '' ? null : Number(value)));
}

// Profile edit - the ficha form. Blank coordinates stay null.
export const citizenProfileInputSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().max(200).optional(),
  documentId: z.string().max(32).optional(),
  addressLine: z.string().max(200).optional(),
  neighborhood: z.string().max(120).optional(),
  email: z.string().max(200).optional(),
  tags: z.string().max(400).optional(),
  observations: z.string().max(2000).optional(),
  partyKind: partyKindSchema,
  latitude: optionalCoord(-90, 90),
  longitude: optionalCoord(-180, 180),
});

export type CitizenProfileInput = z.infer<typeof citizenProfileInputSchema>;

// Register - the citizen id is enough; the database checks the required fields.
export const registerCitizenInputSchema = z.object({
  id: z.string().uuid(),
});

// Merge - two different ids and a note the operator can read.
export const mergeCitizensInputSchema = z
  .object({
    keepId: z.string().uuid(),
    dropId: z.string().uuid(),
    note: z.string().min(1).max(500),
  })
  .refine((value) => value.keepId !== value.dropId, { message: 'MERGE_SELF' });

export type MergeCitizensInput = z.infer<typeof mergeCitizensInputSchema>;

export const citizenSearchQuerySchema = z.object({
  query: z.string().max(80),
});

export type CitizenSearchHit = {
  id: string;
  fullName: string | null;
  documentId: string | null;
  phone: string | null;
  registrationStatus: string | null;
  partyKind: string | null;
  pushName: string | null;
};

export type CitizenProfile = {
  id: string;
  fullName: string | null;
  documentId: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  email: string | null;
  tags: string[];
  observations: string | null;
  partyKind: PartyKind;
  latitude: number | null;
  longitude: number | null;
  registrationStatus: string;
  phones: string[];
  mergedIntoId: string | null;
  whatsappPushName: string | null;
};

export type CitizenTimeline = {
  messages: { id: string; at: string; direction: string; body: string | null }[];
  events: { id: string; at: string; eventType: string; note: string | null }[];
  animals: { id: string; at: string; name: string; species: string; municipalId: string }[];
};
