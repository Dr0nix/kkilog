import { z } from 'zod';

export const ERROR_CODES = ['UNAUTHORIZED', 'ONBOARDING_REQUIRED', 'NOT_FOUND', 'INVALID_REQUEST'] as const;

export const ErrorResponseSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES) }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ErrorCode = (typeof ERROR_CODES)[number];
