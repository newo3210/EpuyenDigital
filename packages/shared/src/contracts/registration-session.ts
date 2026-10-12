import { z } from "zod";

// Registration session contract - step + payload partials

export const registrationStepSchema = z.enum([
  "consent",
  "full_name",
  "document_id",
  "address_line",
  "neighborhood",
  "location",
  "returning_menu",
  "confirm_citizen",
  "animal_name",
  "species",
  "sex",
  "breed_color",
  "size",
  "age_stage",
  "sterilized",
  "rabies_status",
  "health_card_photo_optional",
  "animal_photos",
  "completing",
  "done",
]);

export const sessionPayloadSchema = z.object({
  privacyConsentAt: z.string().datetime().optional(),
  privacyNoticeVersion: z.string().optional(),
  fullName: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  addressLine: z.string().min(1).optional(),
  neighborhood: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  citizenId: z.string().uuid().optional(),
  animalName: z.string().min(1).optional(),
  species: z.enum(["dog", "cat", "other"]).optional(),
  sex: z.enum(["male", "female"]).optional(),
  breedColor: z.string().min(1).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  ageStage: z.string().min(1).optional(),
  sterilized: z.enum(["yes", "no", "unknown"]).optional(),
  rabiesStatus: z.enum(["up_to_date", "pending"]).optional(),
  microchip: z.string().optional(),
  animalPhotoCount: z.number().int().nonnegative().optional(),
  pendingMediaMessageIds: z.array(z.string()).optional(),
  pendingMediaKinds: z
    .record(z.enum(["animal", "health_card"]))
    .optional(),
  completedAnimalId: z.string().uuid().optional(),
  completedMunicipalId: z.string().min(1).optional(),
});

export const registrationSessionSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  lineId: z.string().uuid(),
  phoneNormalized: z.string().regex(/^549\d+$/),
  step: registrationStepSchema,
  payload: sessionPayloadSchema.default({}),
  expiresAt: z.string().datetime(),
});

export type RegistrationSession = z.infer<typeof registrationSessionSchema>;
