@AGENTS.md

# TradeAssistant - Project Context

## What This Is
Single-user XAUUSD (Gold) trading intelligence PWA. Mobile-first (iPhone, iOS Safari PWA). All infrastructure on AWS ap-southeast-1 within free tier.

## Key Architecture Decisions
- **Static export**: Next.js builds to `out/` directory, deployed to S3+CloudFront. No SSR.
- **NodejsFunction**: CDK auto-bundles Lambda TypeScript with esbuild. No separate layer needed.
- **Bedrock model ID**: Use `apac.amazon.nova-micro-v1:0` (inference profile required in ap-southeast-1, NOT the bare model ID).
- **Yahoo Finance**: Free, no API key. Symbols: `GC=F` (gold), `DX-Y.NYB` (DXY), `^TNX` (10Y yield), `^VIX`.
- **DynamoDB single-table for market-data**: Uses pk/sk pattern (see README for key patterns). TTL handles cleanup.
- **Push notifications**: VAPID keys are hardcoded in `infra/lib/stack.ts` (not from process.env which is empty during CDK deploy).
- **Alert dedup**: Each alert has a key like `momentum:rally:4`. Dedup check uses `DEDUP#{date}#{key}` in alerts table with 24hr TTL.
- **iOS limitations**: No custom vibration patterns (navigator.vibrate not supported). All notification haptics feel the same.

## Development Workflow
```bash
npm run dev          # Frontend dev server
./deploy.sh          # Full deploy
./deploy.sh backend  # CDK only (faster iteration on Lambdas)
./deploy.sh frontend # Build + S3 sync + CloudFront invalidation
```

## Testing Lambdas
Always use `--cli-binary-format raw-in-base64-out` with AWS CLI v2 for JSON payloads.
EventBridge-triggered Lambdas use `{"source":"aws.events"}` payload.
API-triggered use `{"httpMethod":"GET","path":"/market/data"}` format.

## File Structure
```
src/                          # Next.js frontend
  app/page.tsx               # Main dashboard (single page)
  components/                # UI components (all "use client")
  hooks/useMarketPolling.ts  # Polling + visibilitychange re-fetch
  lib/store.ts              # Zustand store (PriceData, events, intel, alerts, briefing)
  lib/api.ts                # API fetch functions
  lib/webauthn.ts           # Passkey auth
infra/
  lib/stack.ts              # CDK stack (all resources)
  lambda/functions/
    auth/                   # register.ts, login.ts
    market/                 # data.ts, score.ts, events.ts, intelligence.ts
    alerts/engine.ts        # Alert engine (momentum, escalation, countdown, post-event, accuracy)
    intelligence/           # briefing.ts, weekly-report.ts, premarket.ts
    notifications/push.ts   # web-push sender
public/sw.js               # Service worker (push handler + vibration patterns)
deploy.sh                  # Full deployment script
```

## EventBridge Schedules
| Schedule | Lambda | UTC | SGT |
|----------|--------|-----|-----|
| rate(1 min) | market-data | — | — |
| rate(1 min) | alert-engine | — | — |
| rate(5 min) | market-intel | — | — |
| rate(1 hr) | market-events | — | — |
| cron(0 23 * * ? *) | daily-briefing | 23:00 | 07:00 |
| cron(0 12 * * ? *) | daily-briefing | 12:00 | 20:00 |
| cron(0 13 ? * SUN *) | weekly-report | 13:00 | 21:00 |
| cron(0 15 ? * SUN *) | premarket | 15:00 | 23:00 |

## Important Notes
- Frontend polls every 60s (market open) or 300s (closed). Also re-fetches on visibilitychange.
- Kill zones: London 15:00-16:00 SGT, NY 20:00-22:00 SGT (highlighted in session monitor).
- Alert engine sends push for medium+ severity via LambdaClient invoke (async).
- Weekly report queries ALERT_ACCURACY records to calculate prediction win rate.
- Market events uses FairEconomy feed with fallback generator for weekends.
- Intelligence Lambda generates weekend items (doesn't return early).
- Auth uses grantReadWriteData (not Read) because login updates challenge counter.
