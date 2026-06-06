# TradeAssistant

Personal trading intelligence platform for XAUUSD (Gold). Mobile-first PWA with real-time market data, AI-powered briefings, economic calendar, and push notifications. Single-user, runs entirely on AWS free tier.

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
          ┌──────────┬──────────┬────────────┼────────┬──────────┬──────────────┐
          ▼          ▼          ▼            ▼        ▼          ▼              ▼
   ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌────────────┐
   │Auth      ││Auth      ││Market    ││Market    ││Market    ││Market    ││Weekly      │
   │Register  ││Login     ││Data      ││Score     ││Events    ││Intel     ││Report      │
   └────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└─────┬──────┘
        │           │           │           │           │           │            │
        ▼           ▼           ▼           ▼           ▼           ▼            ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │                              DynamoDB Tables                                         │
   │  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐  ┌───────────────┐  │
   │  │ credentials      │  │ alerts       │  │ market-data       │  │ subscriptions │  │
   │  │ (passkey store)  │  │ (pk/sk+TTL)  │  │ (price/briefing/  │  │ (push subs)   │  │
   │  │ + userId GSI     │  │              │  │  events/intel/    │  │               │  │
   │  │                  │  │              │  │  pivots/report/   │  │               │  │
   │  │                  │  │              │  │  accuracy)        │  │               │  │
   │  └──────────────────┘  └──────────────┘  └───────────────────┘  └───────────────┘  │
   └─────────────────────────────────────────────────────────────────────────────────────┘

          ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐
          │Alert Engine  │───▶│Push Notify Lambda │───▶│Apple Push Service│
          │  (1 min)     │    │ (web-push/VAPID)  │    │(iPhone notifs)   │
          └──────┬───────┘    └───────────────────┘    └─────────────────┘
                 │
          ┌──────┴───────┐    ┌───────────────────┐    ┌─────────────────┐
          │Daily Briefing│───▶│AWS Bedrock        │    │Yahoo Finance    │
          │Weekly Report │    │(Nova Micro - APAC │    │GC=F, DX-Y.NYB  │
          │Pre-Market    │    │ inference profile)│    │^TNX, ^VIX       │
          └──────────────┘    └───────────────────┘    └─────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │                           EventBridge Schedules                                      │
   │                                                                                      │
   │  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐ ┌───────────────┐ │
   │  │Every 1 min │ │Every 5 min│ │Every 1 hr │ │Cron 07:00 & 20:00│ │Cron Sunday    │ │
   │  │Market Data │ │Market     │ │Market     │ │Daily Briefing    │ │21:00 Weekly   │ │
   │  │Alert Engine│ │Intelligence│ │Events     │ │(SGT)             │ │23:00 PreMarket│ │
   │  └────────────┘ └───────────┘ └───────────┘ └──────────────────┘ └───────────────┘ │
   └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + TailwindCSS + Framer Motion + Zustand |
| Backend | AWS Lambda (Node.js 20) + API Gateway REST |
| Database | DynamoDB (PAY_PER_REQUEST, TTL auto-cleanup) |
| Hosting | S3 + CloudFront (static export) |
| IaC | AWS CDK v2 (TypeScript, NodejsFunction auto-bundling with esbuild) |
| Auth | WebAuthn/Passkey (Face ID, single-owner) |
| Notifications | Web Push via VAPID → Apple Push Service |
| AI | AWS Bedrock (Nova Micro via `apac.amazon.nova-micro-v1:0` inference profile) |
| Scheduling | EventBridge Rules (cron + rate) |
| Price Feed | Yahoo Finance (`GC=F` Gold, `DX-Y.NYB` DXY, `^TNX` 10Y, `^VIX`) |
| Calendar | FairEconomy/ForexFactory JSON feed |

## Live URLs

- **App**: https://dp5ho4pdlyl6w.cloudfront.net
- **API**: https://b0031huge4.execute-api.ap-southeast-1.amazonaws.com/prod

## Features

### Market Data
- Real-time XAUUSD price (1-min polling)
- DXY, 10Y Yield, VIX correlations with gold signal interpretation
- Pivot points (PP, R1-R3, S1-S3) calculated from prior day's H/L/C
- Daily range consumed percentage
- Average daily range tracking

### Intelligence
- Sharp move detection (>2% daily moves)
- Volatility spike alerts (>80 pip range)
- Session break detection
- Range breakout signals
- Trend shift identification
- AI-generated daily briefings (morning + evening)

### Alert System
- **Session alerts**: London/NY open approaching
- **Price alerts**: Big daily moves (>2%)
- **Momentum alerts**: 6+ consecutive directional ticks with >10 pip move
- **Rapid spike alerts**: >15 pips in 5 minutes
- **Escalating urgency**: Re-alerts if price continues 3-10 min after initial alert (+5 pips)
- **Event countdown**: "NFP in 15 min" push before high-impact events
- **Post-event summary**: Gold's reaction 30 min after high-impact events
- **Alert accuracy tracking**: Evaluates directional predictions 30 min later, feeds weekly report

### Scheduled Reports
- **Daily briefing** (07:00 + 20:00 SGT): AI bias, support/resistance, volatility outlook
- **Weekly report** (Sunday 21:00 SGT): Week performance, alert accuracy, AI outlook
- **Pre-market open** (Sunday 23:00 SGT): Overnight outlook before Asia open

### Frontend Components
- Gold price card with sparkline chart
- Market health score (0-100)
- Session monitor with kill zone highlighting (London KZ 15-16, NY KZ 20-22 SGT)
- Daily range consumed progress bar (color-coded)
- DXY/10Y/VIX correlations panel with net signal
- Key levels (pivot points + nearest S/R + distance from H/L)
- Economic calendar with impact badges
- Intelligence feed
- Daily briefing card
- Weekly report card (expandable)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Passkey registration (begin/verify) |
| POST | `/auth/login` | Passkey authentication (begin/verify) |
| GET | `/market/data` | Current XAUUSD price + correlations + pivots |
| GET | `/market/score` | Market health score (0-100) |
| GET | `/market/events` | Economic calendar events |
| GET | `/market/intelligence` | Market intelligence feed |
| GET | `/alerts` | Recent alerts (last 50) |
| GET | `/briefing` | Latest AI briefing |
| GET | `/report` | Latest weekly report |
| POST | `/subscribe` | Register push subscription |
| POST | `/notify` | Send push notification |

## Lambda Functions (12 total)

| Function | Entry | Trigger |
|----------|-------|---------|
| `tradeassistant-auth-register` | auth/register.ts | API Gateway POST |
| `tradeassistant-auth-login` | auth/login.ts | API Gateway POST |
| `tradeassistant-market-data` | market/data.ts | EventBridge (1 min) + API |
| `tradeassistant-market-score` | market/score.ts | API Gateway GET |
| `tradeassistant-market-events` | market/events.ts | EventBridge (1 hr) + API |
| `tradeassistant-market-intel` | market/intelligence.ts | EventBridge (5 min) + API |
| `tradeassistant-alert-engine` | alerts/engine.ts | EventBridge (1 min) + API |
| `tradeassistant-push-notify` | notifications/push.ts | Invoked by other Lambdas |
| `tradeassistant-daily-briefing` | intelligence/briefing.ts | EventBridge (cron) + API |
| `tradeassistant-weekly-report` | intelligence/weekly-report.ts | EventBridge (Sun 21:00 SGT) + API |
| `tradeassistant-premarket` | intelligence/premarket.ts | EventBridge (Sun 23:00 SGT) |

## DynamoDB Tables

| Table | Partition Key | Sort Key | TTL | Purpose |
|-------|-------------|----------|-----|---------|
| `tradeassistant-credentials` | credentialId | — | ttl | Passkey credentials + challenges |
| `tradeassistant-alerts` | pk | sk | ttl | Alerts + dedup keys (3-day TTL) |
| `tradeassistant-market-data` | pk | sk | ttl | Price, briefing, events, intel, pivots, reports, accuracy |
| `tradeassistant-subscriptions` | endpoint | — | — | Push notification subscriptions |

### market-data Table Key Patterns

| pk | sk | Content |
|----|-----|---------|
| `LATEST#XAUUSD` | timestamp | Current price snapshot |
| `XAUUSD` | ISO timestamp | Historical price data |
| `EVENTS` | `calendar` | Economic calendar |
| `INTELLIGENCE` | `feed` | Intelligence items |
| `BRIEFING` | `morning:YYYY-MM-DD` | Morning briefing |
| `BRIEFING` | `evening:YYYY-MM-DD` | Evening briefing |
| `REPORT` | `weekly:YYYY-MM-DD` | Weekly report |
| `ALERT_STATE` | `last-momentum` | Momentum state for escalation (15min TTL) |
| `ALERT_ACCURACY` | ISO:key | Directional predictions + outcomes (8-day TTL) |

## Push Notification Types

| Tag | Category | Trigger |
|-----|----------|---------|
| `session-alert` | Session | London/NY session open approaching |
| `price-alert` | Price | >2% move, momentum, rapid spike, escalation |
| `intelligence-alert` | Intelligence | High volatility, rapid moves |
| `economic-alert` | Economic | Event countdown, post-event summary |
| `briefing` | Briefing | Daily briefing, weekly report, pre-market |
| `critical` | Critical | Extreme moves |

### Vibration Patterns (Android only, iOS ignores)
- session-alert: `[200, 100, 200]`
- price-alert: `[100, 50, 100, 50, 300]`
- intelligence-alert: `[300, 100, 300, 100, 300]`
- economic-alert: `[150, 75, 150, 75, 150, 75, 400]`
- critical: `[500, 200, 500, 200, 500]`
- briefing: `[100, 200, 100]`

## Data Flow

```
Yahoo Finance ──1min──▶ Market Data Lambda ──▶ DynamoDB (LATEST#XAUUSD + XAUUSD history)
 (GC=F, DXY,                  │                      │
  TNX, VIX)                   │                      │
                              ▼                      │
                   Correlations + Pivots             │
                   + Range Consumed                  │
                                                    │
                    ┌───────────────────────────────┤
                    ▼                    ▼           ▼
            Market Score          Alert Engine    Market Intelligence
            (on-demand)           (every 1min)    (every 5min)
                                       │
                    ┌──────────────────┤
                    ▼                  ▼
           Momentum/Escalation   Event Countdown
           Detection             + Post-Event
                    │                  │
                    ▼                  ▼
              Push Notify Lambda ──▶ Apple Push ──▶ iPhone

            Accuracy Tracker
            (30 min post-alert evaluation)
                    │
                    ▼
            Weekly Report aggregation
```

## Development

```bash
npm install
npm run dev      # localhost:3000
```

## Deployment

```bash
./deploy.sh          # Full deploy (backend + frontend)
./deploy.sh backend  # CDK only
./deploy.sh frontend # Build + S3 + CloudFront invalidation
```

Or manually:
```bash
# Backend
cd infra && npx cdk deploy TradeAssistant --require-approval never

# Frontend
npx next build
aws s3 sync out/ s3://tradeassistant-site-735902317408 --delete
aws cloudfront create-invalidation --distribution-id E2175DR3YT3UKQ --paths "/*"
```

## Testing Lambdas

```bash
# Market data
aws lambda invoke --function-name tradeassistant-market-data --cli-binary-format raw-in-base64-out --payload '{"httpMethod":"GET","path":"/market/data"}' /tmp/out.json

# Alert engine (trigger mode)
aws lambda invoke --function-name tradeassistant-alert-engine --cli-binary-format raw-in-base64-out --payload '{"source":"aws.events"}' /tmp/out.json

# Push notification
aws lambda invoke --function-name tradeassistant-push-notify --cli-binary-format raw-in-base64-out --payload '{"httpMethod":"POST","path":"/send","body":"{\"title\":\"Test\",\"message\":\"Hello\",\"tag\":\"price-alert\"}"}' /tmp/out.json

# Weekly report
aws lambda invoke --function-name tradeassistant-weekly-report --cli-binary-format raw-in-base64-out --payload '{"source":"aws.events"}' /tmp/out.json

# Pre-market
aws lambda invoke --function-name tradeassistant-premarket --cli-binary-format raw-in-base64-out --payload '{}' /tmp/out.json
```

## Environment Variables

Frontend (`.env.local`):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key for push subscriptions
- `NEXT_PUBLIC_API_URL` - API Gateway base URL
- `NEXT_PUBLIC_APP_URL` - CloudFront app URL

Backend (hardcoded in CDK stack.ts):
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - For web-push
- `VAPID_SUBJECT` - mailto: contact
- DynamoDB table names (auto-configured by CDK)

## Cost

Effectively $0/month for single-user:
- DynamoDB: Within perpetual free tier (25 WCU, 25 RCU, 25GB)
- Lambda: ~2,500 invocations/day fits within 1M free/month
- API Gateway: ~1,500 requests/day fits within 1M free/month (12 months)
- CloudFront: ~1GB/month within 1TB free tier
- EventBridge: Free (included)
- S3: <10MB static site, negligible
- Bedrock Nova Micro: ~$0.01/day for briefings (~2-3 calls/day)
- TTL auto-deletes keep storage lean at zero cost

## Region

All AWS resources in `ap-southeast-1` (Singapore) for lowest latency to user.
