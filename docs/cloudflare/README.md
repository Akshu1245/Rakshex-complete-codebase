# RaksHex Cloudflare-first migration

This directory records staged, non-destructive migration work.

- [CF-02 implementation](./CF02_RUNTIME_MIGRATION.md) describes the
  Cloudflare-native backend slice and how to reproduce it.
- [CF-02 live status](./CF02_LIVE_STATUS.md) separates verified live
  staging functionality from the unported RaksHex features.
- [Previous staging baseline](./MIGRATION_STATUS.md) captures the
  initial deployment resources and production preservation gates.

Only the new `rakshex-core-staging` Worker and isolated staging D1,
Queue, KV and R2 are targets of the CF-02 migration. The existing
production `rakshex-web` and `rakshex-firewall` Workers remain
outside this release. Original PostgreSQL customer data has not
been imported into D1.

To evaluate release readiness, require full CI, security, frontend auth,
database restoration/parity and buyer-journey sign-offs. A passing
single Worker health endpoint is not a production readiness signal.
