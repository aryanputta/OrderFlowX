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

const setup = () => {
  const inventory = new InventoryRepository();
  inventory.seed([{ sku: "sku-1", available: 10, reserved: 0, version: 1 }]);
  return new CheckoutService(
    new OrderRepository(),
    inventory,
    new HoldRepository(),
    new EventOutboxRepository(),
    new MetricsCollector(),
    new IdempotencyRepository(),
    new ConsumerInboxRepository(),
    new FakePaymentGateway(),
    new FakeShipmentGateway(),
  );
};

test("checkout is idempotent on the same key", () => {
  const service = setup();
  const request = {
    customerId: "cust-1",
    idempotencyKey: "idem-1",
    items: [{ sku: "sku-1", quantity: 2 }],
  };
  const first = service.checkout(request);
  const second = service.checkout(request);

  expect(first.orderId).toBe(second.orderId);
  expect(second.status).toBe("CONFIRMED");
});

test("shipment failure triggers compensation and inventory release", () => {
  const inventory = new InventoryRepository();
  inventory.seed([{ sku: "sku-1", available: 10, reserved: 0, version: 1 }]);
  const service = new CheckoutService(
    new OrderRepository(),
    inventory,
    new HoldRepository(),
    new EventOutboxRepository(),
    new MetricsCollector(),
    new IdempotencyRepository(),
    new ConsumerInboxRepository(),
    new FakePaymentGateway(),
    new FakeShipmentGateway(true),
  );

  expect(() =>
    service.checkout({
      customerId: "cust-1",
      idempotencyKey: "idem-2",
      items: [{ sku: "sku-1", quantity: 3 }],
    }),
  ).toThrow();
  expect(inventory.get("sku-1")?.available).toBe(10);
});
