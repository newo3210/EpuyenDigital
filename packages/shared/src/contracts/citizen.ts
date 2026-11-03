import { z } from "zod";

// Citizen upsert - fields collected during registration (GPS/consent optional in UX v2)
export const citizenUpsertSchema = z.object({
  fullName: z.string().min(1),
  documentId: z.string().min(1),
  addressLine: z.string().min(1),
  neighborhood: z.string().min(1).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  privacyConsentAt: z.string().datetime().nullable().optional(),
  phoneNormalized: z.string().regex(/^549\d+$/),
});

export type CitizenUpsert = z.infer<typeof citizenUpsertSchema>;
