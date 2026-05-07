# OrderFlowX

Distributed order reservation system that models cart checkout, inventory holds, payment authorization, shipment reservation, retries, and recovery under partial failure.

## Why It Exists
E-commerce systems fail when inventory reservation, payment state, and order status diverge under retries, duplicate requests, and consumer lag. OrderFlowX focuses on idempotent APIs, state transitions, and event-driven recovery.

## Core Concepts
- idempotent checkout
- inventory holds with expiration
- outbox-style event publishing
- inbox dedupe for event consumers
- retry-safe saga orchestration
- dead-letter and replay workflows
- operational metrics and post-incident analysis

## Amazon-Style Hardening
- explicit idempotency record with response snapshot
- payment and shipment integrations with compensating release flow
- hold expiration worker
- repair request path for stuck orders
- outbox plus consumer inbox dedupe
- metrics for compensation, duplicate hits, and repair actions

## Repo Layout
- `src/domain/`: entities and state machines
- `src/application/`: checkout workflow and reservation logic
- `src/infrastructure/`: in-memory repositories and event bus
- `src/api/`: handler-level API contract logic
- `src/observability/`: metrics and structured logs
- `docs/`: architecture, API contract, runbook, benchmark notes

## Local Commands
```bash
npm install
npm run build
npm test
npm run benchmark
```

## Resume Bullets
- Built OrderFlowX, a distributed order reservation backend that coordinates inventory holds, payment authorization, and shipment reservation through idempotent APIs and retry-safe saga steps.
- Implemented optimistic state transitions, outbox-style event publication, and replay-safe failure handling to prevent oversell and duplicate checkout effects under concurrent requests.
- Benchmarked checkout latency, hold expiration behavior, and recovery outcomes to document correctness tradeoffs under partial failure and duplicate events.
