# RaksHexBench OSS harness

This directory contains external benchmark/failure tooling. None of these tools sit on the production request path.

## k6 readiness baseline

```bash
docker run --rm -i -e BASE_URL=https://api.rakshex.in grafana/k6:latest run - < bench/k6/health-readiness.js
```

For reproducible CI, pin the k6 image digest/version before enabling as a release gate.

## Toxiproxy dependency failures

```bash
docker compose -f bench/chaos/docker-compose.yml up -d
bash bench/chaos/setup.sh
```

Then run RaksHex against:

```text
DATABASE_URL=postgresql://rakshex:rakshex@127.0.0.1:15432/rakshex_chaos
REDIS_URL=redis://127.0.0.1:16379
```

Inject faults:

```bash
bash bench/chaos/add-latency.sh postgres 1500 100
bash bench/chaos/cut-connection.sh redis
bash bench/chaos/reset.sh
```

The core money-path benchmark remains the Vitest/Postgres test in
`apps/api/services/teamGovernance.rakshexBench.integration.test.ts`.
