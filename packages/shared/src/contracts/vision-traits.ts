import { z } from "zod";

// Vision traits - strict LLM vision output
export const visionTraitsSchema = z.object({
  summary: z.string().min(1),
  colors: z.array(z.string()),
  markings: z.array(z.string()),
  notableFeatures: z.array(z.string()),
});

export type VisionTraits = z.infer<typeof visionTraitsSchema>;
