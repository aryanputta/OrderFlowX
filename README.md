# OrderFlowX

A checkout orchestration backend that coordinates inventory holds, payment authorization, and shipment reservation as a retry-safe saga. It stays correct under duplicate requests and partial failure using idempotency records, compensation, hold expiration, and outbox/inbox deduplication.

## Why It Exists

E-commerce checkout fails when inventory, payment, and order state diverge under retries, duplicate delivery, and consumer lag. Two requests for one cart should never double-charge or double-reserve. OrderFlowX makes the checkout path idempotent and self-healing, and it ships a benchmark that measures those properties instead of asserting them.

## Measured Results

Reproducible via `npm run benchmark` (seeded, deterministic). Numbers are computed from the running service, not hardcoded.

| Metric | Without idempotency | With idempotency |
|---|---|---|
| Duplicate checkout side-effect rate | 19.9% | 0.0% |
| Oversell rate (scarce SKU) | 0.0% | 0.0% |
| Failure recovery rate (compensation) | — | 100.0% |
| Checkout latency p50 / p95 / p99 | — | 0.029 / 0.048 / 0.069 ms |

Setup: 1,000 logical checkouts over an at-least-once channel (geometric redelivery, p=0.2, seed 1337) producing 1,249 deliveries; one-third of intents have payment failure injected to exercise compensation. Oversell is 0% in both modes because the inventory guard rejects over-reservation; the failure mode idempotency removes is duplicate orders and duplicate payment authorizations.

## Quickstart

```bash
# Run with Docker
docker compose up --build        # serves on :3000

# Or run locally
npm install
npm run build
npm start                        # serves on :3000
```

```bash
# Prove idempotency end-to-end
bash scripts/demo.sh
```

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/checkout` | Run the checkout saga. Same `idempotencyKey` returns the original order. |
| `POST` | `/orders/:id/repair` | Request repair for a stuck order. |
| `GET` | `/metrics` | Operational counters (compensation, idempotent hits, expired holds). |
| `GET` | `/healthz` | Liveness. |

```bash
curl -X POST localhost:3000/checkout \
  -d '{"customerId":"c1","idempotencyKey":"k1","items":[{"sku":"SKU-PHONE","quantity":1}]}'
# Repeat the same call: same orderId, no second reservation or charge.
```

## How It Stays Correct

- **Idempotency record with response snapshot** — a retried request returns the original order instead of re-running the saga.
- **Saga with compensation** — if payment or shipment fails, holds are released and the order is failed cleanly, so inventory is never leaked.
- **Hold expiration worker** — abandoned holds are released so stock is reclaimed.
- **Outbox + consumer inbox dedupe** — events are published once and consumed at-most-once.
- **State machine** — every order transition is validated, so illegal transitions cannot occur.

## Repo Layout

- `src/domain/` — entities, state machine, errors
- `src/application/` — checkout saga, idempotency, integrations
- `src/infrastructure/` — repositories and event store
- `src/api/` — HTTP handlers and contract mapping
- `src/index.ts` — HTTP server and composition root
- `src/bench/` — the measuring benchmark harness
- `docs/` — architecture, API contract, runbook, benchmark notes

## Commands

```bash
npm test            # unit tests
npm run benchmark   # build + run the measuring harness, writes benchmarks/results/
npm start           # start the HTTP server
bash scripts/demo.sh
```

## Resume Bullets

- Built a checkout orchestration backend (TypeScript) coordinating inventory holds, payment authorization, and shipment reservation as a retry-safe saga with compensation and hold expiration.
- Drove the service to a **measured 19.9% -> 0% duplicate checkout side-effect rate and 100% failure recovery** across 1,000 retried requests using idempotency records, optimistic state transitions, outbox events, and inbox deduplication.
- Shipped a seeded, reproducible benchmark and a Dockerized HTTP API so the correctness claims are independently verifiable.
