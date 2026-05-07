import { CheckoutService } from "../../src/application/checkoutService";
import { FakePaymentGateway, FakeShipmentGateway } from "../../src/application/integrations";
import {
  ConsumerInboxRepository,
  EventOutboxRepository,
  HoldRepository,
  IdempotencyRepository,
  InventoryRepository,
  OrderRepository,
} from "../../src/infrastructure/repositories";
import { MetricsCollector } from "../../src/observability/metrics";

test("expired holds are released", () => {
  const inventory = new InventoryRepository();
  inventory.seed([{ sku: "sku-1", available: 5, reserved: 0, version: 1 }]);
  const holds = new HoldRepository();
  const service = new CheckoutService(
    new OrderRepository(),
    inventory,
    holds,
    new EventOutboxRepository(),
    new MetricsCollector(),
    new IdempotencyRepository(),
    new ConsumerInboxRepository(),
    new FakePaymentGateway(),
    new FakeShipmentGateway(),
  );

  service.checkout({
    customerId: "cust-1",
    idempotencyKey: "hold-expire-1",
    items: [{ sku: "sku-1", quantity: 1 }],
  });

  const orderHolds = holds.listByOrder(
    service.checkout({
      customerId: "cust-1",
      idempotencyKey: "hold-expire-1",
      items: [{ sku: "sku-1", quantity: 1 }],
    }).orderId,
  );
  for (const hold of orderHolds) {
    hold.expiresAt = "2000-01-01T00:00:00.000Z";
  }

  service.expireHolds("2001-01-01T00:00:00.000Z");
  expect(inventory.get("sku-1")?.available).toBe(5);
});
