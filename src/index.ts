import { createServer, IncomingMessage, ServerResponse } from "http";
import { CheckoutService } from "./application/checkoutService";
import { ApiHandlers } from "./api/handlers";
import {
  ConsumerInboxRepository,
  EventOutboxRepository,
  HoldRepository,
  IdempotencyRepository,
  InventoryRepository,
  OrderRepository,
} from "./infrastructure/repositories";
import { MetricsCollector } from "./observability/metrics";
import { FakePaymentGateway, FakeShipmentGateway } from "./application/integrations";
import { InventoryRecord } from "./domain/types";

const SEED_INVENTORY: InventoryRecord[] = [
  { sku: "SKU-LAPTOP", available: 500, reserved: 0, version: 1 },
  { sku: "SKU-PHONE", available: 500, reserved: 0, version: 1 },
  { sku: "SKU-CABLE", available: 1000, reserved: 0, version: 1 },
];

// Composition root: wire the in-memory adapters, gateways, and service once.
export function buildApp() {
  const orders = new OrderRepository();
  const inventory = new InventoryRepository();
  inventory.seed(SEED_INVENTORY);
  const holds = new HoldRepository();
  const outbox = new EventOutboxRepository();
  const metrics = new MetricsCollector();
  const idempotency = new IdempotencyRepository();
  const inbox = new ConsumerInboxRepository();
  const service = new CheckoutService(
    orders,
    inventory,
    holds,
    outbox,
    metrics,
    idempotency,
    inbox,
    new FakePaymentGateway(),
    new FakeShipmentGateway(),
  );
  return { service, metrics, handlers: new ApiHandlers(service), expireHolds: () => service.expireHolds() };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(payload);
}

export function createApp() {
  const app = buildApp();
  // Background worker: release expired inventory holds so stock is never leaked.
  const holdWorker = setInterval(() => app.expireHolds(), 30_000);
  holdWorker.unref?.();

  const server = createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      if (req.method === "GET" && url === "/healthz") {
        return send(res, 200, { status: "ok" });
      }
      if (req.method === "GET" && url === "/metrics") {
        return send(res, 200, { metrics: app.metrics.list() });
      }
      if (req.method === "POST" && url === "/checkout") {
        const raw = await readBody(req);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw || "{}");
        } catch {
          return send(res, 400, { message: "invalid JSON body" });
        }
        const result = app.handlers.postCheckout(parsed as never);
        return send(res, result.statusCode, result.body);
      }
      const repair = url.match(/^\/orders\/([^/]+)\/repair$/);
      if (req.method === "POST" && repair) {
        const raw = await readBody(req);
        const body = raw ? (JSON.parse(raw) as { reason?: string }) : {};
        const result = app.handlers.postRepair(repair[1], body.reason ?? "manual");
        return send(res, result.statusCode, result.body);
      }
      return send(res, 404, { message: "not found" });
    } catch (error) {
      send(res, 500, { message: String(error) });
    }
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`OrderFlowX listening on :${port}`);
  });
}
