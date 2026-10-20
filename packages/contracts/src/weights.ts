import { z } from 'zod';
import { oneDecimal } from './onboarding';

// POST /api/weights — 같은 client_request_id면 새로 만들지 않고 기존 기록을 200으로 돌려준다(spec 3).
export const CreateWeightRequestSchema = z.object({
  weight_kg: oneDecimal(20, 300),
  client_request_id: z.uuid(),
});
export type CreateWeightRequest = z.input<typeof CreateWeightRequestSchema>;

export const WeightLogSchema = z.object({
  id: z.uuid(),
  local_date: z.string(),
  weight_kg: z.number(),
  measured_at: z.string(),
});
export type WeightLog = z.infer<typeof WeightLogSchema>;

export const CreateWeightResponseSchema = z.object({ weight: WeightLogSchema });
export type CreateWeightResponse = z.infer<typeof CreateWeightResponseSchema>;
