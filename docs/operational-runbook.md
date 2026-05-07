# Operational Runbook

## Symptoms
- rising checkout retries
- duplicate idempotency keys
- hold buildup
- inventory reserve/release mismatch

## Debug Flow
1. Inspect the order by idempotency key.
2. Confirm order state transition history.
3. Compare inventory available vs reserved.
4. Inspect outbox delivery lag.
5. Confirm whether the consumer inbox already processed the event.

## Recovery
1. Release expired holds.
2. Replay safe events from the outbox.
3. Mark irrecoverable orders as failed with a reason.
4. Use the repair endpoint for stuck but recoverable orders.
