import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().email("Please enter a valid email address").max(200),
  subject: z.string().trim().min(3, "Please add a short subject").max(120),
  message: z.string().trim().min(10, "Please tell us a little more (at least 10 characters)").max(4000),
  orderReference: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9-]*$/, "Order references contain only letters, numbers and dashes")
    .optional()
    .or(z.literal("")),
  // Honeypot: real people leave this empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
