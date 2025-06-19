import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Current password is required.'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters long.')
      .refine((val) => /[A-Z]/.test(val), {
        message: 'New password must contain at least one uppercase letter.',
      })
      .refine((val) => /[.,]/.test(val), {
        message: 'New password must contain at least one special character.',
      }),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });
