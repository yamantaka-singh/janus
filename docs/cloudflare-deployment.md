# Janus Cloudflare Workers Deployment Guide

This document describes how to build, preview, and deploy Janus (Next.js 16.4+) to **Cloudflare Workers** using the `@opennextjs/cloudflare` adapter.

---

## Architecture & Edge Optimizations

Janus has been optimized specifically for Cloudflare's V8 Isolate execution model:

1. **Wasm Argon2id (`hash-wasm`)**:
   - Replaced native C++ bindings (`node-argon2`) with WebAssembly implementation.
   - Retains 100% hash format compatibility with `$argon2id$v=19$...` database records.
2. **Decoupled Image Pipeline**:
   - Stripped native `sharp` (`libvips`) dependencies from edge routes to prevent runtime crashes in isolate environments.
   - Buffer pass-through logic preserves incoming image streams for cloud storage and inference dispatch.
3. **OpenNext Cloudflare Adapter**:
   - Bundles Next.js server components and routes with Node.js compatibility flags into `.open-next/worker.js`.
   - Assets are routed directly via Cloudflare Assets binding.
4. **Contract-First ANPR Client**:
   - Communicates securely with edge Argus instances through Cloudflare Tunnel with automated injection of `CF-Access-Client-Id`, `CF-Access-Client-Secret`, and `X-API-Key`.

---

## Prerequisites

1. Cloudflare account with Workers & Pages enabled.
2. Wrangler CLI (installed as project devDependency `wrangler@^4.165.0`).
3. Authenticated Cloudflare session:
   ```bash
   pnpm wrangler login
   ```

---

## Environment Variables

Configure the following secrets in Cloudflare Workers via Wrangler or the Cloudflare Dashboard:

```bash
# Supabase Backend
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-service-role-key"

# Argus ANPR Microservice (Cloudflare Tunnel)
ARGUS_API_URL="https://anpr-1.gluvok.com"
ARGUS_API_KEY="your-secure-argus-api-key"

# Cloudflare Zero Trust Access Service Token
CLOUDFLARE_ACCESS_CLIENT_ID="your-client-id.access"
CLOUDFLARE_ACCESS_CLIENT_SECRET="your-client-secret"
```

To set secrets via CLI:

```bash
pnpm wrangler secret put SUPABASE_URL
pnpm wrangler secret put SUPABASE_PUBLISHABLE_KEY
pnpm wrangler secret put ARGUS_API_URL
pnpm wrangler secret put ARGUS_API_KEY
pnpm wrangler secret put CLOUDFLARE_ACCESS_CLIENT_ID
pnpm wrangler secret put CLOUDFLARE_ACCESS_CLIENT_SECRET
```

---

## Build & Deployment Commands

### 1. Build Worker Bundle

Compiles Next.js with OpenNext targeting the Cloudflare Worker runtime:

```bash
pnpm build:worker
```

Build outputs are placed in `.open-next/`:

- `.open-next/worker.js`: Cloudflare Worker entry point.
- `.open-next/assets/`: Static assets and Next.js bundle chunks.

### 2. Local Preview with Wrangler

Runs the compiled bundle locally inside the workerd runtime emulator:

```bash
pnpm preview:worker
```

### 3. Deploy to Cloudflare

Deploy directly to production:

```bash
pnpm wrangler deploy
```

---

## Configuration Reference

### `wrangler.json`

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "gluvok-janus",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "vars": {
    "NODE_ENV": "production"
  }
}
```

### `open-next.config.ts`

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```
