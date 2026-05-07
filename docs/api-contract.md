# API Contract

## POST /checkout
Request:
```json
{
  "customerId": "cust-1",
  "idempotencyKey": "checkout-123",
  "items": [
    { "sku": "sku-1", "quantity": 2 }
  ]
}
```

Responses:
- `201` confirmed order payload
- `400` validation error
- `409` insufficient inventory or state conflict

## POST /orders/{orderId}/repair
Request:
```json
{
  "reason": "shipment consumer stalled"
}
```

Responses:
- `202` repair requested
- `404` order not found
