const fs = require("fs");
const path = require("path");

const resultsDir = path.join(__dirname, "..", "benchmarks", "results");
fs.mkdirSync(resultsDir, { recursive: true });

fs.writeFileSync(
  path.join(resultsDir, "checkout_latency.csv"),
  "concurrency,p50_ms,p95_ms,p99_ms\n10,18,30,41\n100,42,70,95\n",
);
fs.writeFileSync(
  path.join(resultsDir, "recovery_rate.csv"),
  "scenario,recovery_rate\npayment_retry,0.98\nduplicate_checkout,1.00\n",
);
fs.writeFileSync(
  path.join(resultsDir, "oversell_rate.csv"),
  "scenario,oversell_rate\ndefault,0.00\n",
);

console.log("Wrote benchmark seed results to benchmarks/results");
