import { z } from "zod";

// Animal draft - required animal fields before completion
export const animalDraftSchema = z.object({
  name: z.string().min(1),
  species: z.enum(["dog", "cat", "other"]),
  sex: z.enum(["male", "female"]),
  breedColor: z.string().min(1),
  size: z.enum(["small", "medium", "large"]),
  ageStage: z.string().min(1),
  sterilized: z.enum(["yes", "no", "unknown"]),
  rabiesStatus: z.enum(["up_to_date", "pending"]),
  microchip: z.string().optional(),
});

export type AnimalDraft = z.infer<typeof animalDraftSchema>;
