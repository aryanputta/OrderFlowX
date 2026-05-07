# Benchmark Report

Seed benchmark outputs live in `benchmarks/results`.

Tracked metrics:
- checkout latency
- recovery rate under retries
- oversell rate
- idempotent checkout hit count
- compensation execution count
- expired hold release count

The current harness is a local deterministic seed. Replace with real concurrent load output in the next iteration.
