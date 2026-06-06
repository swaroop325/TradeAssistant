# TradeAssistant

Personal trading intelligence platform for XAUUSD (Gold). Mobile-first PWA with real-time market data, AI-powered briefings, economic calendar, and push notifications.

## AWS Architecture

```
                          ┌─────────────────────────────────────────────────────┐
                          │                   CloudFront                         │
                          │            dp5ho4pdlyl6w.cloudfront.net              │
                          └────────────────────┬────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
        ┌───────────────────┐    ┌───────────────────────┐    ┌──────────────────┐
        │    S3 Bucket      │    │   API Gateway (REST)   │    │   Service Worker  │
        │  Static PWA       │    │   /prod/*              │    │   Push + Cache    │
        │  Next.js Export   │    └───────────┬───────────┘    └──────────────────┘
        └───────────────────┘                │
                                             │
          ┌──────────────┬──────────────┬────┴────┬──────────────┬──────────────┐
          ▼              ▼              ▼         ▼              ▼              ▼
   ┌─────────────┐┌─────────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────────┐
   │Auth Register││Auth Login   ││Market    ││Market    ││Market    ││Market        │
   │  Lambda     ││  Lambda     ││Data      ││Score     ││Events    ││Intelligence  │
   └──────┬──────┘└──────┬──────┘│  Lambda  ││  Lambda  ││  Lambda  ││  Lambda      │
          │              │       └────┬─────┘└────┬─────┘└────┬─────┘└──────┬───────┘
          │              │            │           │           │             │
          ▼              ▼            ▼           ▼           ▼             ▼
   ┌─────────────────────────────────────────────────────────────────────────────────┐
   │                              DynamoDB Tables                                     │
   │  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐  ┌───────────┐  │
   │  │ credentials      │  │ alerts       │  │ market-data       │  │subscriptions│ │
   │  │ (passkey store)  │  │ (pk/sk+TTL)  │  │ (price/briefing/  │  │(push subs) │  │
   │  │ + userId GSI     │  │              │  │  events/intel)    │  │            │  │
   │  └──────────────────┘  └──────────────┘  └───────────────────┘  └───────────┘  │
   └─────────────────────────────────────────────────────────────────────────────────┘

          ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐
          │Alert Engine  │───▶│Push Notify Lambda │───▶│Apple Push Service│
          │  Lambda      │    │ (web-push/VAPID)  │    │(iPhone notifs)   │
          └──────┬───────┘    └───────────────────┘    └─────────────────┘
                 │
          ┌──────┴───────┐    ┌───────────────────┐    ┌─────────────────┐
          │Daily Briefing│───▶│AWS Bedrock        │    │Yahoo Finance    │
          │  Lambda      │    │(Nova Micro - AI)  │    │(GC=F price feed)│
          └──────────────┘    └───────────────────┘    └─────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────────────┐
   │                           EventBridge Schedules                                  │
   │                                                                                  │
   │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────────────┐ │
   │  │Every 1 min │  │Every 5 min   │  │Every 1 hour │  │Cron: 07:00 & 20:00 SGT│ │
   │  │Market Data │  │Alert Engine  │  │Market Events│  │Daily Briefing          │ │
   │  │            │  │Market Intel  │  │             │  │                        │ │
   │  └────────────┘  └──────────────┘  └─────────────┘  └────────────────────────┘ │
   └─────────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + TypeScript + TailwindCSS + Framer Motion + Zustand |
| Backend | AWS Lambda (Node.js 20) + API Gateway REST |
| Database | DynamoDB (PAY_PER_REQUEST, TTL-enabled) |
| Hosting | S3 + CloudFront (static export) |
| IaC | AWS CDK v2 (TypeScript, NodejsFunction auto-bundling) |
| Auth | WebAuthn/Passkey (Face ID, single-owner) |
| Notifications | Web Push via VAPID → Apple Push Service |
| AI | AWS Bedrock (Nova Micro) for daily briefings |
| Scheduling | EventBridge Rules (cron + rate) |
| Price Feed | Yahoo Finance (`GC=F` Gold Futures, keyless) |
| Calendar | FairEconomy/ForexFactory JSON feed |

## Live URLs

- **App**: https://dp5ho4pdlyl6w.cloudfront.net
- **API**: https://b0031huge4.execute-api.ap-southeast-1.amazonaws.com/prod

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register/options` | Start passkey registration |
| POST | `/auth/register/verify` | Complete registration |
| POST | `/auth/login/options` | Start authentication |
| POST | `/auth/login/verify` | Complete authentication |
| GET | `/market/data` | Current XAUUSD price (Yahoo Finance) |
| GET | `/market/score` | Market health score (0-100) |
| GET | `/market/events` | Economic calendar events |
| GET | `/market/intelligence` | Market intelligence feed |
| GET | `/alerts` | Recent alerts |
| GET | `/briefing` | Daily AI briefing |
| POST | `/subscribe` | Register push subscription |

## Lambda Functions (9 total)

| Function | Entry | Trigger |
|----------|-------|---------|
| `tradeassistant-auth-register` | auth/register.ts | API Gateway POST |
| `tradeassistant-auth-login` | auth/login.ts | API Gateway POST |
| `tradeassistant-market-data` | market/data.ts | EventBridge (1 min) + API |
| `tradeassistant-market-score` | market/score.ts | API Gateway GET |
| `tradeassistant-market-events` | market/events.ts | EventBridge (1 hr) + API |
| `tradeassistant-market-intel` | market/intelligence.ts | EventBridge (5 min) + API |
| `tradeassistant-alert-engine` | alerts/engine.ts | EventBridge (5 min) + API |
| `tradeassistant-push-notify` | notifications/push.ts | Invoked by Alert Engine |
| `tradeassistant-daily-briefing` | intelligence/briefing.ts | EventBridge (cron) + API |

## DynamoDB Tables

| Table | Partition Key | Sort Key | TTL | Purpose |
|-------|-------------|----------|-----|---------|
| `tradeassistant-credentials` | credentialId | — | ttl | Passkey credentials + challenges |
| `tradeassistant-alerts` | pk | sk | ttl | Alerts + dedup keys |
| `tradeassistant-market-data` | pk | sk | ttl | Price, briefing, events, intelligence |
| `tradeassistant-subscriptions` | endpoint | — | — | Push notification subscriptions |

## Push Notification Types

| Tag | Category | Trigger |
|-----|----------|---------|
| `session-alert` | Session | London/NY session approaching |
| `price-alert` | Price | Gold moves >2% in a day |
| `intelligence-alert` | Intelligence | High volatility (>80 pip range) |
| `economic-alert` | Economic | High-impact event imminent |
| `briefing` | Briefing | Morning/evening AI briefing |

## Data Flow

```
Yahoo Finance (GC=F) ──1min──▶ Market Data Lambda ──▶ DynamoDB (LATEST#XAUUSD)
                                                              │
                    ┌─────────────────────────────────────────┤
                    ▼                    ▼                     ▼
            Market Score          Alert Engine          Market Intelligence
            (on-demand)           (every 5min)           (every 5min)
                                       │
                                       ▼
                              Push Notify Lambda ──▶ Apple Push ──▶ iPhone
```

## Development

```bash
npm install
npm run dev
```

## Deployment

```bash
./deploy.sh
```

Or manually:
```bash
# Backend
cd infra && npx cdk deploy

# Frontend
npx next build
aws s3 sync out/ s3://tradeassistant-site-735902317408 --delete
aws cloudfront create-invalidation --distribution-id E2175DR3YT3UKQ --paths "/*"
```

## Environment Variables

Frontend (`.env.local`):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key for push subscriptions
- `NEXT_PUBLIC_API_URL` - API Gateway base URL
- `NEXT_PUBLIC_APP_URL` - CloudFront app URL

Backend (set in CDK stack):
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - For sending push notifications
- `VAPID_SUBJECT` - mailto: contact for VAPID
- DynamoDB table names (auto-configured by CDK)

## Region

All AWS resources deployed in `ap-southeast-1` (Singapore) for lowest latency.
