import { randomUUID } from "crypto";
import { ConflictError, ValidationError } from "../domain/errors";
import { CheckoutRequest, checkoutRequestSchema } from "./checkoutTypes";
import {
  ConsumerInboxRepository,
  EventOutboxRepository,
  HoldRepository,
  IdempotencyRepository,
  InventoryRepository,
  OrderRepository,
} from "../infrastructure/repositories";
import { DomainEvent, InventoryHold, Order } from "../domain/types";
import { nowIso } from "./clock";
import { MetricsCollector } from "../observability/metrics";
import { hashRequest } from "./hash";
import { PaymentGateway, ShipmentGateway } from "./integrations";

export class CheckoutService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly inventory: InventoryRepository,
    private readonly holds: HoldRepository,
    private readonly outbox: EventOutboxRepository,
    private readonly metrics: MetricsCollector,
    private readonly idempotency: IdempotencyRepository,
    private readonly inbox: ConsumerInboxRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly shipmentGateway: ShipmentGateway,
  ) {}

  checkout(request: CheckoutRequest): Order {
    const parsed = checkoutRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const requestHash = hashRequest(request);
    const idempotencyRecord = this.idempotency.get(request.idempotencyKey);
    if (idempotencyRecord?.responseSnapshot) {
      this.metrics.record({
        metricName: "IdempotentCheckoutHit",
        value: 1,
        unit: "Count",
      });
      return idempotencyRecord.responseSnapshot;
    }
    if (idempotencyRecord?.status === "IN_PROGRESS") {
      throw new ConflictError("Checkout already in progress for this idempotency key");
    }

    const timestamp = nowIso();
    this.idempotency.put({
      idempotencyKey: request.idempotencyKey,
      requestHash,
      status: "IN_PROGRESS",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const order: Order = {
      orderId: randomUUID(),
      customerId: request.customerId,
      idempotencyKey: request.idempotencyKey,
      items: request.items,
      status: "PENDING",
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    this.orders.create(order);
    this.outbox.append(this.event("ORDER_CREATED", order.orderId, { customerId: order.customerId }));

    try {
      for (const item of order.items) {
        this.inventory.reserve(item.sku, item.quantity);
        const hold: InventoryHold = {
          holdId: randomUUID(),
          orderId: order.orderId,
          sku: item.sku,
          quantity: item.quantity,
          createdAt: timestamp,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
        this.holds.create(hold);
      }

      const reserved = this.orders.updateStatus(order.orderId, "INVENTORY_RESERVED", {});
      this.outbox.append(
        this.event("INVENTORY_RESERVED", order.orderId, { items: reserved.items }),
      );

      const amountUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const paymentReference = this.paymentGateway.authorize(order.orderId, amountUnits);
      const authorized = this.orders.updateStatus(order.orderId, "PAYMENT_AUTHORIZED", {
        paymentReference,
      });
      this.outbox.append(
        this.event("PAYMENT_AUTHORIZED", order.orderId, {
          paymentReference: authorized.paymentReference,
        }),
      );

      const shipmentReservationId = this.shipmentGateway.reserve(order.orderId);
      this.outbox.append(
        this.event("SHIPMENT_RESERVED", order.orderId, {
          shipmentReservationId,
        }),
      );
      const confirmed = this.orders.updateStatus(order.orderId, "CONFIRMED", {
        shipmentReservationId,
      });
      this.outbox.append(
        this.event("ORDER_CONFIRMED", order.orderId, {
          shipmentReservationId: confirmed.shipmentReservationId,
        }),
      );
      this.idempotency.put({
        idempotencyKey: request.idempotencyKey,
        requestHash,
        status: "COMPLETED",
        responseSnapshot: confirmed,
        createdAt: timestamp,
        updatedAt: nowIso(),
      });
      this.metrics.record({
        metricName: "CheckoutCompleted",
        value: 1,
        unit: "Count",
      });
      return confirmed;
    } catch (error) {
      this.compensate(order.orderId);
      this.idempotency.put({
        idempotencyKey: request.idempotencyKey,
        requestHash,
        status: "FAILED",
        createdAt: timestamp,
        updatedAt: nowIso(),
      });
      this.failOrder(order.orderId, String(error));
      throw error;
    }
  }

  failOrder(orderId: string, reason: string): Order {
    const current = this.orders.get(orderId);
    if (!current) {
      throw new ConflictError(`Order ${orderId} not found`);
    }
    const nextStatus =
      current.status === "PENDING" ? "FAILED" : current.status === "INVENTORY_RESERVED" ? "FAILED" : "FAILED";
    const failed = this.orders.updateStatus(orderId, nextStatus, { failureReason: reason });
    this.outbox.append(this.event("ORDER_FAILED", orderId, { reason }));
    return failed;
  }

  expireHolds(now = nowIso()): string[] {
    const expired = this.holds.listExpired(now);
    for (const hold of expired) {
      this.inventory.release(hold.sku, hold.quantity);
      this.holds.delete(hold.holdId);
      this.outbox.append(
        this.event("HOLD_EXPIRED", hold.orderId, {
          holdId: hold.holdId,
          sku: hold.sku,
          quantity: hold.quantity,
        }),
      );
      this.metrics.record({
        metricName: "ExpiredHoldReleased",
        value: 1,
        unit: "Count",
      });
    }
    return expired.map((hold) => hold.holdId);
  }

  requestRepair(orderId: string, reason: string): Order {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new ConflictError(`Order ${orderId} not found`);
    }
    this.outbox.append(this.event("ORDER_REPAIR_REQUESTED", orderId, { reason }));
    this.metrics.record({
      metricName: "RepairRequested",
      value: 1,
      unit: "Count",
    });
    return order;
  }

  consumeEvent(event: DomainEvent): boolean {
    if (this.inbox.has(event.eventId)) {
      return false;
    }
    this.inbox.markProcessed(event.eventId);
    return true;
  }

  private compensate(orderId: string): void {
    const holds = this.holds.listByOrder(orderId);
    for (const hold of holds) {
      this.inventory.release(hold.sku, hold.quantity);
      this.holds.delete(hold.holdId);
    }
    this.metrics.record({
      metricName: "CompensationExecuted",
      value: holds.length,
      unit: "Count",
    });
  }

  private event(
    eventType: DomainEvent["eventType"],
    aggregateId: string,
    payload: DomainEvent["payload"],
  ): DomainEvent {
    return {
      eventId: randomUUID(),
      eventType,
      aggregateId,
      payload,
      createdAt: nowIso(),
    };
  }
}
