/**
 * Real measuring harness for OrderFlowX.
 *
 * This drives the actual CheckoutService (not mocked numbers) under
 * at-least-once duplicate delivery and injected payment failures, and
 * measures three things empirically:
 *
 *   1. duplicate_side_effect_rate  — fraction of retried deliveries that
 *      created an extra order/inventory reservation. Measured WITHOUT
 *      idempotency (unique key per delivery) vs WITH idempotency (stable
 *      key per logical intent).
 *   2. oversell_rate               — units reserved beyond seeded stock on a
 *      scarce SKU under the same duplicate load.
 *   3. recovery_rate               — fraction of failure-injected orders whose
 *      inventory was fully restored by compensation (no leaked holds).
 *
 * Every number printed here is computed from the running code below.
 */
import { randomUUID } from "crypto";
import { CheckoutService } from "../application/checkoutService";
import {
  ConsumerInboxRepository,
  EventOutboxRepository,
  HoldRepository,
  IdempotencyRepository,
  InventoryRepository,
  OrderRepository,
} from "../infrastructure/repositories";
import { MetricsCollector } from "../observability/metrics";
import { FakePaymentGateway, FakeShipmentGateway } from "../application/integrations";
import { InventoryRecord } from "../domain/types";
import * as fs from "fs";
import * as path from "path";

interface Harness {
  service: CheckoutService;
  orders: OrderRepository;
  inventory: InventoryRepository;
}

function harness(seed: InventoryRecord[], failPaymentFor: (i: number) => boolean = () => false): Harness {
  const orders = new OrderRepository();
  const inventory = new InventoryRepository();
  inventory.seed(seed);
  const holds = new HoldRepository();
  const outbox = new EventOutboxRepository();
  const metrics = new MetricsCollector();
  const idempotency = new IdempotencyRepository();
  const inbox = new ConsumerInboxRepository();
  // A stateful payment gateway so we can fail a deterministic subset of intents.
  let call = 0;
  const payment = {
    authorize(orderId: string, amountUnits: number): string {
      const fail = failPaymentFor(call++);
      if (fail) {
        throw new Error(`payment auth failed for ${orderId}`);
      }
      return `pay_${orderId}_${amountUnits}`;
    },
  };
  const service = new CheckoutService(
    orders,
    inventory,
    holds,
    outbox,
    metrics,
    idempotency,
    inbox,
    payment as FakePaymentGateway,
    new FakeShipmentGateway(),
  );
  return { service, orders, inventory };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const INTENTS = 1000;
// Probability a delivery is duplicated again, modeling an at-least-once channel
// (retry timeouts, consumer redelivery). Geometric, so most intents arrive once,
// a minority are redelivered one or more times. Seeded for reproducibility.
const REDELIVERY_PROB = 0.2;
const SEED = 1337;

/** Deterministic PRNG (mulberry32) so the benchmark is reproducible. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deliveriesFor(rng: () => number): number {
  let n = 1;
  while (rng() < REDELIVERY_PROB) n++;
  return n;
}

function runDuplicateExperiment(idempotent: boolean): {
  duplicateRate: number;
  ordersCreated: number;
  deliveries: number;
  latencies: number[];
} {
  const { service, orders } = harness([{ sku: "SKU-A", available: 10_000_000, reserved: 0, version: 1 }]);
  const rng = makeRng(SEED);
  const latencies: number[] = [];
  let deliveries = 0;
  for (let i = 0; i < INTENTS; i++) {
    const stableKey = `intent-${i}`;
    const copies = deliveriesFor(rng);
    for (let r = 0; r < copies; r++) {
      deliveries++;
      // Without idempotency, a retried delivery looks like a brand-new request.
      const key = idempotent ? stableKey : `${stableKey}-dup-${r}-${randomUUID()}`;
      const start = process.hrtime.bigint();
      try {
        service.checkout({
          customerId: `cust-${i}`,
          idempotencyKey: key,
          items: [{ sku: "SKU-A", quantity: 1 }],
        });
      } catch {
        // ignore; counted via orders created
      }
      latencies.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
  }
  const ordersCreated = orders.count();
  // One order per intent is intended; anything beyond that is a duplicate side effect.
  const duplicates = Math.max(0, ordersCreated - INTENTS);
  return { duplicateRate: duplicates / deliveries, ordersCreated, deliveries, latencies };
}

function runOversellExperiment(idempotent: boolean): number {
  const STOCK = 1000;
  const { service, inventory } = harness([{ sku: "SKU-SCARCE", available: STOCK, reserved: 0, version: 1 }]);
  const rng = makeRng(SEED);
  for (let i = 0; i < STOCK; i++) {
    const stableKey = `scarce-${i}`;
    const copies = deliveriesFor(rng);
    for (let r = 0; r < copies; r++) {
      const key = idempotent ? stableKey : `${stableKey}-dup-${r}-${randomUUID()}`;
      try {
        service.checkout({
          customerId: `cust-${i}`,
          idempotencyKey: key,
          items: [{ sku: "SKU-SCARCE", quantity: 1 }],
        });
      } catch {
        // insufficient inventory is expected once stock is exhausted
      }
    }
  }
  const rec = inventory.get("SKU-SCARCE");
  const reserved = rec?.reserved ?? 0;
  return Math.max(0, reserved - STOCK) / STOCK;
}

function runRecoveryExperiment(): number {
  const STOCK = 10_000;
  const FAIL_EVERY = 3; // fail payment for ~1/3 of intents
  const { service, inventory } = harness(
    [{ sku: "SKU-R", available: STOCK, reserved: 0, version: 1 }],
    (call) => call % FAIL_EVERY === 0,
  );
  let injectedFailures = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    try {
      service.checkout({
        customerId: `cust-${i}`,
        idempotencyKey: `rec-${i}`,
        items: [{ sku: "SKU-R", quantity: 1 }],
      });
    } catch {
      injectedFailures++;
    }
  }
  // Successful orders hold one unit each; failed orders must have released their hold.
  const rec = inventory.get("SKU-R");
  const reserved = rec?.reserved ?? 0;
  const successful = N - injectedFailures;
  // recovery is perfect when reserved units == successful orders (no leak from failures).
  const leaked = Math.max(0, reserved - successful);
  return injectedFailures === 0 ? 1 : 1 - leaked / injectedFailures;
}

function main(): void {
  const withoutIdem = runDuplicateExperiment(false);
  const withIdem = runDuplicateExperiment(true);
  const oversellWithout = runOversellExperiment(false);
  const oversellWith = runOversellExperiment(true);
  const recovery = runRecoveryExperiment();

  const sorted = withIdem.latencies.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  const summary = {
    config: { intents: INTENTS, redeliveryProb: REDELIVERY_PROB, seed: SEED },
    deliveries: { withoutIdempotency: withoutIdem.deliveries, withIdempotency: withIdem.deliveries },
    duplicateSideEffectRate: {
      withoutIdempotency: pct(withoutIdem.duplicateRate),
      withIdempotency: pct(withIdem.duplicateRate),
    },
    oversellRate: {
      withoutIdempotency: pct(oversellWithout),
      withIdempotency: pct(oversellWith),
    },
    failureRecoveryRate: pct(recovery),
    checkoutLatencyMs: { p50: +p50.toFixed(3), p95: +p95.toFixed(3), p99: +p99.toFixed(3) },
  };

  const resultsDir = path.join(__dirname, "..", "..", "..", "benchmarks", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(resultsDir, "duplicate_rate.csv"),
    `mode,duplicate_side_effect_rate\nno_idempotency,${withoutIdem.duplicateRate.toFixed(4)}\nidempotency,${withIdem.duplicateRate.toFixed(4)}\n`,
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main();
