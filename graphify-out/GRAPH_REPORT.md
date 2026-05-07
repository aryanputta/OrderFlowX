# Graph Report - .  (2026-05-07)

## Corpus Check
- 18 files · ~2,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 80 nodes · 110 edges · 15 communities detected
- Extraction: 67% EXTRACTED · 33% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `CheckoutService` - 9 edges
2. `InventoryRepository` - 5 edges
3. `OrderRepository` - 5 edges
4. `HoldRepository` - 5 edges
5. `ApiHandlers` - 4 edges
6. `EventOutboxRepository` - 4 edges
7. `MetricsCollector` - 3 edges
8. `FakePaymentGateway` - 3 edges
9. `FakeShipmentGateway` - 3 edges
10. `nowIso()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (5): setup(), IdempotencyRepository, InventoryRepository, OrderRepository, assertTransition()

### Community 1 - "Community 1"
Cohesion: 0.26
Nodes (3): CheckoutService, nowIso(), hashRequest()

### Community 2 - "Community 2"
Cohesion: 0.27
Nodes (4): consumeWithInbox(), flushOutbox(), ConsumerInboxRepository, EventOutboxRepository

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (2): FakePaymentGateway, FakeShipmentGateway

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (1): HoldRepository

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (5): ConflictError, InsufficientInventoryError, PaymentAuthorizationError, ShipmentReservationError, ValidationError

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (1): ApiHandlers

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (1): EventBus

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (1): MetricsCollector

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **5 isolated node(s):** `ValidationError`, `ConflictError`, `InsufficientInventoryError`, `PaymentAuthorizationError`, `ShipmentReservationError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `createLogger()`, `logger.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `holdExpiration.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `stateMachine.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `run-benchmark.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `checkoutTypes.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CheckoutService` connect `Community 1` to `Community 2`, `Community 4`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `InventoryRepository` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `ValidationError`, `ConflictError`, `InsufficientInventoryError` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._