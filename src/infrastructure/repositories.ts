import {
  DomainEvent,
  IdempotencyRecord,
  InventoryHold,
  InventoryRecord,
  Order,
  OrderStatus,
} from "../domain/types";
import { ConflictError, InsufficientInventoryError } from "../domain/errors";
import { assertTransition } from "../domain/stateMachine";

export class InventoryRepository {
  private readonly inventory = new Map<string, InventoryRecord>();

  seed(records: InventoryRecord[]): void {
    records.forEach((record) => this.inventory.set(record.sku, record));
  }

  get(sku: string): InventoryRecord | undefined {
    return this.inventory.get(sku);
  }

  reserve(sku: string, quantity: number): InventoryRecord {
    const record = this.inventory.get(sku);
    if (!record || record.available < quantity) {
      throw new InsufficientInventoryError(`Insufficient inventory for ${sku}`);
    }

    const next: InventoryRecord = {
      ...record,
      available: record.available - quantity,
      reserved: record.reserved + quantity,
      version: record.version + 1,
    };
    this.inventory.set(sku, next);
    return next;
  }

  release(sku: string, quantity: number): InventoryRecord | undefined {
    const record = this.inventory.get(sku);
    if (!record) {
      return undefined;
    }
    const next: InventoryRecord = {
      ...record,
      available: record.available + quantity,
      reserved: Math.max(0, record.reserved - quantity),
      version: record.version + 1,
    };
    this.inventory.set(sku, next);
    return next;
  }
}

export class OrderRepository {
  private readonly orders = new Map<string, Order>();
  private readonly idempotencyIndex = new Map<string, string>();

  create(order: Order): Order {
    this.orders.set(order.orderId, order);
    this.idempotencyIndex.set(order.idempotencyKey, order.orderId);
    return order;
  }

  findByIdempotencyKey(key: string): Order | undefined {
    const orderId = this.idempotencyIndex.get(key);
    return orderId ? this.orders.get(orderId) : undefined;
  }

  get(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  updateStatus(orderId: string, nextStatus: OrderStatus, attributes: Partial<Order>): Order {
    const current = this.orders.get(orderId);
    if (!current) {
      throw new ConflictError(`Order ${orderId} not found`);
    }
    assertTransition(current.status, nextStatus);
    const updated: Order = {
      ...current,
      ...attributes,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.orders.set(orderId, updated);
    return updated;
  }
}

export class HoldRepository {
  private readonly holds = new Map<string, InventoryHold>();

  create(hold: InventoryHold): InventoryHold {
    this.holds.set(hold.holdId, hold);
    return hold;
  }

  listByOrder(orderId: string): InventoryHold[] {
    return [...this.holds.values()].filter((hold) => hold.orderId === orderId);
  }

  listExpired(now: string): InventoryHold[] {
    return [...this.holds.values()].filter((hold) => hold.expiresAt <= now);
  }

  delete(holdId: string): void {
    this.holds.delete(holdId);
  }
}

export class EventOutboxRepository {
  private readonly events: DomainEvent[] = [];

  append(event: DomainEvent): void {
    this.events.push(event);
  }

  list(): DomainEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

export class IdempotencyRepository {
  private readonly records = new Map<string, IdempotencyRecord>();

  get(idempotencyKey: string): IdempotencyRecord | undefined {
    return this.records.get(idempotencyKey);
  }

  put(record: IdempotencyRecord): IdempotencyRecord {
    this.records.set(record.idempotencyKey, record);
    return record;
  }
}

export class ConsumerInboxRepository {
  private readonly processed = new Set<string>();

  has(eventId: string): boolean {
    return this.processed.has(eventId);
  }

  markProcessed(eventId: string): void {
    this.processed.add(eventId);
  }
}
