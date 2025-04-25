import { z } from 'zod';

export const userSchema = z
  .object({
    email: z.string().trim().nonempty().email('Please enter a valid email address.'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters long.')
      .refine((val) => /[A-Z]/.test(val), {
        message: 'Password must contain at least one uppercase letter.',
      })
      .refine((val) => /[.,]/.test(val), {
        message: 'Password must contain at least one special character.',
      }),
    passwordConfirm: z.string(),

    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long.')
      .refine((val) => !/\d/.test(val), {
        message: 'Name cannot contain numbers.',
      })
      .refine((val) => /^[a-zA-ZğüşöçıİĞÜŞÖÇ'\s-]+$/.test(val), {
        message: 'Name contains invalid characters.',
      }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });
