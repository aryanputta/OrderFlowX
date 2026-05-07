import { ConflictError } from "./errors";
import { OrderStatus } from "./types";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["INVENTORY_RESERVED", "FAILED", "CANCELLED"],
  INVENTORY_RESERVED: ["PAYMENT_AUTHORIZED", "FAILED", "CANCELLED"],
  PAYMENT_AUTHORIZED: ["CONFIRMED", "FAILED", "CANCELLED"],
  CONFIRMED: [],
  FAILED: [],
  CANCELLED: [],
};

export const assertTransition = (
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): void => {
  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new ConflictError(
      `Invalid order transition from ${currentStatus} to ${nextStatus}`,
    );
  }
};
