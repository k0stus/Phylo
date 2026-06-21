# Phylo — Setup Guide

## Repo structure

```
/
├── app/          Expo React Native app
└── server/       Cloudflare Workers (REST API + Durable Objects)
```

The `BattleRoom` and `MatchmakingQueue` Durable Objects live **inside `/server`** as named exports from the same Worker.  
One `wrangler.toml`, shared TypeScript types, single deploy target — simpler than a separate `/realtime` project.

---

## 1. Server setup

### Prerequisites
- Node 20+
- Wrangler CLI: `npm i -g wrangler`
- Cloudflare account

### Install
```bash
cd server
npm install
```

### Create Cloudflare resources

```bash
# D1 database
wrangler d1 create phylo-db
# Copy the database_id into wrangler.toml

# KV namespaces
wrangler kv:namespace create RATE_LIMITS
wrangler kv:namespace create INVITE_CODES
# Copy both IDs into wrangler.toml

# Secrets (never paste these in chat — run locally)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put JWT_SECRET
```

### Run migrations
```bash
npm run db:migrate:local    # local dev
npm run db:migrate          # production
```

### Run dev server
```bash
npm run dev
# Runs at http://localhost:8787
```

### Deploy
```bash
npm run deploy
```

---

## 2. App setup

### Prerequisites
- Node 20+, Expo CLI (`npm i -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator / physical device with Expo Go

### Install
```bash
cd app
npm install
```

### Configure
Create `app/.env.local`:
```
EXPO_PUBLIC_API_URL=http://localhost:8787
```
Change to your deployed Worker URL before building for production.

### Run
```bash
npm run ios
# or
npm run android
```

---

## 3. Deep links (invites)

The app registers the `phylo://` scheme. When User A creates an invite:
- They get a short code (e.g. `AB3X7K`) and a deep link `phylo://battle/invite/AB3X7K`
- The iOS share sheet opens; they send the link via Messages/WhatsApp/etc.
- User B taps the link → the app opens to the Battle tab with the code pre-filled → lobby connects

For local testing use `npx uri-scheme open phylo://battle/invite/TEST123 --ios`.

---

## 4. Rate limiting

- 5 solo + battle scans per user per day (combined)
- Change `DAILY_SCAN_LIMIT` in `wrangler.toml` vars
- Invite codes expire in 10 minutes (`INVITE_CODE_TTL_SECONDS`)
- Random matchmaking times out in 60 seconds (`MATCHMAKING_TIMEOUT_SECONDS`)

---

## 5. Key design decisions

| Decision | Rationale |
|---|---|
| Durable Objects inside `/server` | One deploy, shared types, no cross-service token passing |
| D1 for all persistent state | Serverless SQLite, free tier generous, no connection pooling needed |
| KV for invite codes | Short-lived, TTL-native, no cleanup needed |
| Singleton `MatchmakingQueue` DO | One global queue; DO guarantees serialized state with no race conditions |
| JWT in WS query param | CF Workers WS upgrade can't carry custom headers; short-lived access tokens make this acceptable |
| Photos never stored server-side | Backend only persists scores; each user's photos stay on their own device |
