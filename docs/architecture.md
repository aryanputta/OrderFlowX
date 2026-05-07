# Architecture

```text
Client -> Checkout API -> CheckoutService
CheckoutService -> OrderRepository
CheckoutService -> InventoryRepository
CheckoutService -> HoldRepository
CheckoutService -> IdempotencyRepository
CheckoutService -> PaymentGateway
CheckoutService -> ShipmentGateway
CheckoutService -> EventOutboxRepository -> EventBus
Consumers -> ConsumerInboxRepository
MetricsCollector <- service-level operational metrics
```

## Boundaries
- API layer validates and maps error responses.
- Application layer owns checkout orchestration, compensation, and hold expiration.
- Domain layer owns state transitions and invariants.
- Infrastructure layer owns persistence, idempotency, inbox/outbox, and event delivery.
