import { z } from 'zod';

// Area entity - municipal area row mapped to camelCase for the panel.
export const areaSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().nullable(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  slaWarningMinutes: z.number().int().positive().nullable(),
  slaCriticalMinutes: z.number().int().positive().nullable(),
});

export type Area = z.infer<typeof areaSchema>;

// Area membership - operator assigned to an area, optionally as lead.
export const areaMembershipSchema = z.object({
  areaId: z.string().uuid(),
  userId: z.string().uuid(),
  isLead: z.boolean(),
});

export type AreaMembership = z.infer<typeof areaMembershipSchema>;
