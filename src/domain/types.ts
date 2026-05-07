export const orderStatuses = [
  "PENDING",
  "INVENTORY_RESERVED",
  "PAYMENT_AUTHORIZED",
  "CONFIRMED",
  "FAILED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface Order {
  orderId: string;
  customerId: string;
  idempotencyKey: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentReference?: string;
  shipmentReservationId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InventoryRecord {
  sku: string;
  available: number;
  reserved: number;
  version: number;
}

export interface InventoryHold {
  holdId: string;
  orderId: string;
  sku: string;
  quantity: number;
  expiresAt: string;
  createdAt: string;
}

export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType:
    | "ORDER_CREATED"
    | "INVENTORY_RESERVED"
    | "PAYMENT_AUTHORIZED"
    | "SHIPMENT_RESERVED"
    | "ORDER_CONFIRMED"
    | "ORDER_FAILED"
    | "HOLD_EXPIRED"
    | "PAYMENT_FAILED"
    | "SHIPMENT_FAILED"
    | "ORDER_REPAIR_REQUESTED";
  aggregateId: string;
  payload: T;
  createdAt: string;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  requestHash: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  responseSnapshot?: Order;
  createdAt: string;
  updatedAt: string;
}
