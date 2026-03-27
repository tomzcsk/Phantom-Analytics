#!/usr/bin/env bash
# ============================================================
# Phantom Analytics — One-Command Bootstrap
# ./scripts/setup.sh
# ============================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────

RESET='\033[0m'
BOLD='\033[1m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'

info()    { echo -e "${BLUE}  [info]${RESET}  $*"; }
success() { echo -e "${GREEN}  [ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}  [warn]${RESET}  $*"; }
error()   { echo -e "${RED}  [error]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}==>  $*${RESET}"; }

# ── Validate working directory ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo ""
echo -e "${BOLD}  Phantom Analytics — Setup${RESET}"
echo -e "  ${BLUE}Your data. Your server. Your rules.${RESET}"
echo ""

# ── Check prerequisites ────────────────────────────────────────────────────

step "Checking prerequisites"

# Node.js >= 20
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js 20+ from https://nodejs.org"
fi
NODE_VERSION=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if (( NODE_VERSION < 20 )); then
  error "Node.js 20+ required. Current: $(node -v)"
fi
success "Node.js $(node -v)"

# pnpm >= 9
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
fi
success "pnpm $(pnpm -v)"

# Docker
if ! command -v docker &>/dev/null; then
  error "Docker not found. Install Docker Desktop from https://www.docker.com"
fi
success "Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"

# Docker Compose
if ! docker compose version &>/dev/null; then
  error "Docker Compose plugin not found. Update Docker Desktop."
fi
success "Docker Compose $(docker compose version --short)"

# ── Environment file ───────────────────────────────────────────────────────

step "Setting up environment"

if [ ! -f ".env" ]; then
  cp .env.example .env
  # Generate a random JWT secret
  JWT_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/change_me_to_a_32_character_random_string_here/${JWT_SECRET}/" .env
  else
    sed -i "s/change_me_to_a_32_character_random_string_here/${JWT_SECRET}/" .env
  fi
  success ".env created with a generated JWT_SECRET"
  warn "Review .env and update DASHBOARD_USER / DASHBOARD_PASS before production use"
else
  success ".env already exists — skipping"
fi

# ── Install dependencies ───────────────────────────────────────────────────

step "Installing dependencies"

pnpm install --frozen-lockfile 2>/dev/null || pnpm install
success "All workspace packages installed"

# ── Install Husky hooks ────────────────────────────────────────────────────

step "Installing Husky pre-commit hooks"

pnpm exec husky install 2>/dev/null || true
chmod +x .husky/pre-commit 2>/dev/null || true
success "Husky hooks installed"

# ── Build shared types ─────────────────────────────────────────────────────

step "Building shared types"

pnpm --filter @phantom/shared build
success "@phantom/shared built"

# ── Docker stack ───────────────────────────────────────────────────────────

step "Starting Docker services"

docker compose -f docker/docker-compose.yml pull --quiet
docker compose -f docker/docker-compose.yml up -d postgres redis
info "Waiting for PostgreSQL to be ready..."

# Poll until healthy
MAX_ATTEMPTS=30
ATTEMPTS=0
until docker compose -f docker/docker-compose.yml exec -T postgres \
    pg_isready -U phantom -d phantom_analytics &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if (( ATTEMPTS >= MAX_ATTEMPTS )); then
    error "PostgreSQL did not become healthy within ${MAX_ATTEMPTS} attempts"
  fi
  sleep 2
done
success "PostgreSQL is ready"

until docker compose -f docker/docker-compose.yml exec -T redis \
    redis-cli ping &>/dev/null; do
  sleep 1
done
success "Redis is ready"

# ── Type-check all packages ────────────────────────────────────────────────

step "Type-checking all packages"

pnpm -r type-check 2>/dev/null && success "All type checks pass" || warn "Some type checks failed — check output above"

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}  Setup complete!${RESET}"
echo ""
echo -e "  To start full development stack:"
echo -e "    ${BLUE}docker compose -f docker/docker-compose.yml up -d${RESET}"
echo ""
echo -e "  To start API with hot reload:"
echo -e "    ${BLUE}pnpm --filter api dev${RESET}"
echo ""
echo -e "  To start dashboard with HMR:"
echo -e "    ${BLUE}pnpm --filter dashboard dev${RESET}"
echo ""
echo -e "  Verify database schema:"
echo -e "    ${BLUE}docker compose -f docker/docker-compose.yml exec postgres psql -U phantom -d phantom_analytics -c '\\dt'${RESET}"
echo ""
