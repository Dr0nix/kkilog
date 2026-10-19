import { z } from 'zod';

// GET /api/me
export const MeResponseSchema = z.object({
  has_profile: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
