#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════
# deploy.sh — Full deployment of unfit-coach-tracker
#   0. Install deps (pnpm)
#   1. Create D1 database (idempotent) and sync the ID into configs
#   2. Schema migration
#   3. Seed initial data
#   4. Deploy cron Worker      (wrangler.worker.toml)
#   5. Build frontend          (Vite → dist/)
#   6. Deploy Pages + Functions (wrangler.toml, D1 bound via config)
# ════════════════════════════════════════════════════════════════

DB_NAME="unfit-coach-db"
PAGES_PROJECT="unfit-coach-tracker"
WRANGLER="pnpm exec wrangler"

echo "═══════════════════════════════════════════════════════════════"
echo "  unfit-coach-tracker — Full Deploy"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "▶ [0/6] Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "▶ [1/6] Ensuring D1 database '$DB_NAME' exists..."
DB_ID=$($WRANGLER d1 list --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const m=j.find(d=>d.name===process.argv[1]);process.stdout.write(m?m.uuid:"")}catch{process.stdout.write("")}})' "$DB_NAME")

if [ -z "$DB_ID" ]; then
  $WRANGLER d1 create "$DB_NAME"
  DB_ID=$($WRANGLER d1 list --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const m=j.find(d=>d.name===process.argv[1]);process.stdout.write(m?m.uuid:"")})' "$DB_NAME")
fi

if [ -z "$DB_ID" ]; then
  echo "  ✗ Could not resolve the D1 database id. Aborting."
  exit 1
fi
echo "  → D1 id: $DB_ID"

# Keep both configs pointing at the real database
for f in wrangler.toml wrangler.worker.toml; do
  if grep -q 'REPLACE_WITH_D1_ID' "$f"; then
    sd 'REPLACE_WITH_D1_ID' "$DB_ID" "$f" 2>/dev/null || sed -i '' "s/REPLACE_WITH_D1_ID/$DB_ID/g" "$f"
    echo "  → updated $f"
  fi
done

echo ""
echo "▶ [2/6] Running schema migration..."
$WRANGLER d1 execute "$DB_NAME" --file=schema.sql --remote --yes

echo ""
echo "▶ [3/6] Seeding initial data..."
$WRANGLER d1 execute "$DB_NAME" --file=seed.sql --remote --yes

echo ""
echo "▶ [4/6] Deploying cron Worker..."
$WRANGLER deploy -c wrangler.worker.toml

echo ""
echo "▶ [5/6] Building frontend (Vite + Primer)..."
pnpm build

echo ""
echo "▶ [6/6] Deploying to Cloudflare Pages..."
$WRANGLER pages project create "$PAGES_PROJECT" --production-branch main 2>/dev/null \
  || echo "  → Pages project already exists (OK)"
$WRANGLER pages deploy

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo ""
echo "  Frontend:    https://$PAGES_PROJECT.pages.dev"
echo "  API:         https://$PAGES_PROJECT.pages.dev/api/coaches"
echo "  Stats:       https://$PAGES_PROJECT.pages.dev/api/stats"
echo "  Worker:      https://unfit-coach-sync.<subdomain>.workers.dev/health"
echo "  Manual sync: curl -X POST https://unfit-coach-sync.<subdomain>.workers.dev/sync"
echo "═══════════════════════════════════════════════════════════════"
