import { z } from "zod";

export const checkoutRequestSchema = z.object({
  customerId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
