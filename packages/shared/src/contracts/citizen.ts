import { z } from "zod";

// Citizen upsert - fields collected during registration
export const citizenUpsertSchema = z.object({
  fullName: z.string().min(1),
  documentId: z.string().min(1),
  addressLine: z.string().min(1),
  neighborhood: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  privacyConsentAt: z.string().datetime(),
  phoneNormalized: z.string().regex(/^549\d+$/),
});

export type CitizenUpsert = z.infer<typeof citizenUpsertSchema>;
