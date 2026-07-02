import { z } from 'zod';

export const completeOnboardingSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  avatarUrl: z.string().nullable(),
  theme: z.string().default('default'),
});

export const updatePreferencesSchema = z.object({
  theme: z.string().optional(),
  defaultCalView: z.enum(['week', 'day', 'month']).optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  avatarUrl: z.string().nullable().optional(),
});
