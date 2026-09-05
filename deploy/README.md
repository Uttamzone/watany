# Deployment - Hetzner server

Single-node **k3s** cluster on a Hetzner VPS (`62.238.97.0`, `wataniandsons.ca`),
chosen over plain Docker Compose so the same manifests scale to a real
multi-node HA cluster later without a rewrite. TLS via `cert-manager` +
Let's Encrypt; frontend + backend share one origin through one Traefik
Ingress (no CORS, no cross-site cookie problem).

The server has only 3.7GB RAM, so the deployed footprint is deliberately
minimal - no in-cluster monitoring stack (see "Known gaps" below).

## Layout

```
deploy/
├── k8s/
│   ├── 00-namespace.yaml            # `watani` namespace
│   ├── 01-backend-config.yaml       # non-secret backend env (ConfigMap)
│   ├── 02-backend.yaml              # watani-b2c-service Deployment/Service/PVC
│   ├── 03-frontend.yaml             # watani-b2c-website Deployment/Service
│   ├── 04-ingress.yaml              # path-based routing: /api,/uploads,/actuator -> backend, / -> frontend
│   ├── 05-cluster-issuer.yaml       # Let's Encrypt ClusterIssuer (HTTP-01)
│   ├── 06-traefik-https-redirect.yaml
│   ├── 07-rate-limit.yaml           # Traefik Middleware, edge-level per-IP rate limit
│   └── 08-amanat.yaml               # amanat-backend ConfigMap/Deployment/Service/Ingress (own subdomain)
├── lib.sh                           # shared functions - not run directly, sourced by the deploy-*.sh scripts
├── README.md                        # this file
└── (repo root) deploy-all.sh, deploy-backend.sh, deploy-frontend.sh, deploy-amanat.sh, .env.deploy(.example)
```

Secrets are **never committed**. `watani-db-credentials` and
`amanat-backend-credentials` (DB URL/user/pass, JWT secret, etc.) were
created directly on the server with generated values - see "Secrets" below
to retrieve/rotate them.

## Deploying

```bash
cp .env.deploy.example .env.deploy   # fill in REMOTE_HOST etc. - gitignored
./deploy-all.sh          # full release - all 3 modules
./deploy-backend.sh      # watani-b2c-service only
./deploy-frontend.sh     # watani-b2c-website only
./deploy-amanat.sh       # amanat-portal-watany-generated only
```

Each is a thin wrapper around `deploy/lib.sh` (not run directly), which
holds the shared preflight check, image build/ship/rollout, and pruning
logic once instead of duplicating it four times.

Before building anything, every script SSHes in and health-checks the
server's mandatory prerequisites - k3s node readiness, PostgreSQL, and
cert-manager (pods + the `watani-tls` certificate). Any failure aborts
before touching a running workload.

Builds happen **locally** (needs Docker Desktop or equivalent) and ship
straight into the server's k3s containerd via `docker save | k3s ctr images
import` - no registry involved. Each run tags images with a timestamp and
runs `kubectl rollout status`, which fails the script if the new pod doesn't
become healthy - a bad deploy never silently replaces a working one (the old
pod just keeps serving; investigate and re-run, or `kubectl rollout undo`).

## Server-side setup already done

Not reproducible by `deploy.sh` - infrastructure, not application code:

- k3s installed (`curl -sfL https://get.k3s.io | sudo sh -s -`), bundled
  Traefik + local-path-provisioner in use.
- PostgreSQL 18 (pre-existing, host-installed) opened to the pod network only:
  `listen_addresses` includes the k3s CNI bridge IP (`10.42.0.1`), `pg_hba.conf`
  scoped to `watani_b2c`/`watany_db_user` from `10.42.0.0/16` - never exposed
  beyond localhost + the pod network.
- `ufw` (22/80/443 only), `fail2ban` (sshd jail), `unattended-upgrades` - all
  active.
- `pgBackRest`: WAL archiving on, daily full backup via `/etc/cron.d/pgbackrest-daily`
  (03:15, 7-day retention), repo at `/var/lib/pgbackrest` - **local disk only**,
  protects against accidental drops/corruption but not full-disk loss. Add an
  S3 (Hetzner Object Storage) `repo2` when a bucket exists - layers on without
  disrupting the local repo.

## Resource limits & memory tuning (3.7GB host)

Everything below was sized specifically for this server's 3.7GB / 2 vCPU
budget (2026-08). Re-check these if the server is resized, or if a new
component is added to the stack.

**Rough steady-state budget** (`free -h` after all pods settle): OS + k3s
system components (containerd, kubelet, Traefik, cert-manager,
local-path-provisioner) + pgBackRest ≈ 1.2-1.5GB, PostgreSQL ≈ 400-500MB,
backend pod up to 768Mi, frontend pod up to 512Mi - leaves headroom but not a
lot; treat any new workload on this node as needing to fit inside it.

- **Backend JVM** (`02-backend.yaml`, `JAVA_TOOL_OPTIONS`): `-XX:+UseSerialGC
  -XX:MaxRAMPercentage=70 -XX:MaxMetaspaceSize=160m
  -XX:ReservedCodeCacheSize=64m -XX:MaxDirectMemorySize=64m -Xss768k
  -XX:+ExitOnOutOfMemoryError`, pod `limits.memory: 768Mi` /
  `requests.memory: 384Mi`. SerialGC and capped metaspace/code-cache/stack
  keep fixed overhead low for a single small container; `ExitOnOutOfMemoryError`
  fails fast so k8s restarts a wedged pod instead of it limping along.
  `MaxDirectMemorySize` is set explicitly (2026-08-23) - left unset it defaults
  to matching `-Xmx` (~538Mi), an effectively-unbounded extra allowance on top
  of heap that this REST API has no real need for (no heavy NIO/streaming);
  64m matches the code-cache budget. Verified against the live pod
  (2026-08-23): resolved `MaxHeapSize` ≈538Mi, steady-state `VmRSS` ≈464Mi,
  0 restarts over 3.5h uptime - the existing sizing is holding up fine in
  practice, this only closes the one flag that was still effectively unbounded.
- **Frontend Node.js** (`03-frontend.yaml`, `NODE_OPTIONS`):
  `--max-old-space-size=384`, pod `limits.memory: 512Mi` /
  `requests.memory: 256Mi`. Explicit rather than relying on Node's cgroup-limit
  auto-detection, so the V8 heap stays bounded well below the container limit
  (leaves ~128Mi for non-heap: buffers, native modules, thread stacks).
- **HikariCP** (`01-backend-config.yaml`): `SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=10`,
  `SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=5` (was `20`/unset - each idle
  Postgres connection has a real, if modest, memory cost, and 20 was
  oversized for a 2 vCPU box with one backend replica). `minimumIdle` below
  `maximumPoolSize` lets the pool shrink under low traffic instead of always
  holding the max open.
- **PostgreSQL 18** (host-installed, `/etc/postgresql/18/main/postgresql.conf`
  + `ALTER SYSTEM`-managed `postgresql.auto.conf`) - was running entirely on
  factory defaults sized for a generic/larger box; tuned 2026-08 for this
  specific 3.7GB shared host:
  | Setting | Was | Now | Why |
  |---|---|---|---|
  | `max_connections` | 100 | 40 | Hikari pool (10) + headroom for `psql`/migrations/backups; fewer possible slots means less shared memory reserved upfront |
  | `shared_buffers` | 128MB | 320MB | ~8.5% of 3.7GB - a shared (not dedicated) host doesn't want the usual 25% rule of thumb |
  | `effective_cache_size` | 4GB (unset, PG default) | 1536MB | previous value literally exceeded total system RAM; this is a planner hint, not an allocation, but a wildly wrong one produces bad plans |
  | `work_mem` | 4MB (default) | 8MB | safe to raise now that `max_connections` is capped lower (worst case 40 x 8MB = 320MB) |
  | `maintenance_work_mem` | 64MB (default) | 128MB | vacuum/index builds only, not many concurrent |
  | `max_worker_processes` | 8 (default) | 4 | matches 2 vCPUs |
  | `max_parallel_workers` | 8 (default) | 2 | matches 2 vCPUs |
  | `max_parallel_workers_per_gather` | 2 (default) | 1 | avoid one query claiming both cores |

  `max_connections`, `shared_buffers`, and `max_worker_processes` need a full
  `postgresql@18-main` restart to take effect (`pg_reload_conf()` alone isn't
  enough for those three); the rest apply on reload. To re-check current
  values: `sudo -u postgres psql -c "SHOW <setting>;"`. To change one:
  `sudo -u postgres psql -c "ALTER SYSTEM SET <setting> = '<value>';"` then
  reload/restart as needed - preferred over hand-editing `postgresql.conf`
  directly (`ALTER SYSTEM` writes to `postgresql.auto.conf`, is scriptable
  over SSH without a text editor, and is trivially reversible with
  `ALTER SYSTEM RESET <setting>;`).

## Secrets - retrieve or rotate

```bash
# DB credentials / JWT secret
sudo k3s kubectl get secret watani-db-credentials -n watani -o yaml
```

To rotate the DB password: `ALTER ROLE watany_db_user WITH PASSWORD '...'` as
the `postgres` user, then `kubectl create secret generic watani-db-credentials
... --dry-run=client -o yaml | kubectl apply -f -` (or edit in place) and
`kubectl rollout restart deployment/watani-b2c-service -n watani`.

## TLS certificate

`cert-manager` + the `letsencrypt-prod` `ClusterIssuer`
(`05-cluster-issuer.yaml`) issue and renew `watani-tls` automatically -
Let's Encrypt certs are valid 90 days, cert-manager renews at ~30 days
remaining via the same HTTP-01 challenge, no manual action needed. Check
status any time:

```bash
sudo k3s kubectl get certificate -n watani
```

## Known gaps / deliberate deferrals

- **No in-cluster monitoring** - Prometheus/Grafana/Uptime Kuma were removed
  (2026-08) to reclaim memory on the 3.7GB server; `kubectl top pods` and
  `journalctl` cover ad-hoc checks. Every `deploy-*.sh` script runs a
  preflight health check (k3s node, PostgreSQL, cert-manager) before
  deploying, in place of a standing monitoring stack. Re-add a lightweight
  stack only if the server is resized.
- **No Docker daemon on the server** - removed (2026-08) as dead weight;
  images ship straight into k3s's own containerd via `k3s ctr images
  import`, which never used the Docker daemon in the first place. A local
  Docker (Desktop or equivalent) is still required on the machine running
  the deploy scripts, just not on the server.
- **Single node** - no survival of a full server/hardware failure. Real HA
  needs 2+ more nodes (k3s server join for control-plane HA, Patroni for
  Postgres, a Hetzner Load Balancer in front). The manifests here are
  designed not to need a rewrite when that happens.
- **CI/CD is manual** (`deploy-*.sh` from a developer machine), by choice -
  not GitHub Actions/registry-based.
- **Backups are local-disk only** - see pgBackRest note above.
