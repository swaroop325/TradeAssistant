# SYSTEM PROMPT FOR CLAUDE CODE

Build a production-grade personal trading intelligence platform called  **Gold FX War Room** .

Use the attached dashboard screenshot as inspiration only. Improve the UI significantly and make it feel like a premium institutional trading terminal with modern animations.

---

## PROJECT GOAL

Create a single-user, passkey-only, mobile-first Progressive Web App (PWA) focused exclusively on XAUUSD (Gold).

The platform should:

* Deliver intelligent trading alerts
* Provide market context
* Show session countdowns
* Monitor economic events
* Send push notifications to iPhone
* Use Face ID login
* Operate at low AWS cost
* Be production-ready

Target users: 1

No multi-tenant support required.

---

# TECH STACK

Frontend:

* Next.js 15 App Router
* TypeScript
* TailwindCSS
* Shadcn UI
* Framer Motion
* Zustand
* Recharts

Backend:

* AWS Lambda
* API Gateway
* EventBridge
* DynamoDB
* Cognito
* CloudWatch

Hosting:

* S3
* CloudFront

Optional AI:

* AWS Bedrock
* Amazon Nova Micro

Avoid:

* EC2
* Kubernetes
* RDS

Prefer fully serverless architecture.

---

# AUTHENTICATION

Passkey only.

No passwords.

No SMS.

No email OTP.

No magic links.

Use:

* WebAuthn
* Face ID
* Touch ID

Requirements:

* First deployment allows a single passkey registration.
* First registered user becomes owner.
* Registration closes automatically.
* Only registered passkeys may log in.

Store credentials in DynamoDB.

Require:

userVerification = required

residentKey = required

discoverableCredentials = required

Provide device management:

Settings → Registered Devices

Allow:

* Rename device
* Revoke device

---

# NOTIFICATION FLOW

User must authenticate first.

Only after login:

1. Register service worker
2. Request notification permission
3. Subscribe device
4. Save push subscription
5. Enable alerts

Anonymous users cannot subscribe.

Notifications:

* Web Push (Primary)
* Telegram (Backup)

---

# TIMEZONE

Default:

Asia/Singapore

Display all times in SGT.

Examples:

FOMC:
02:00 SGT

CPI:
20:30 SGT

Support timezone switching in settings.

Store internally in UTC.

---

# DATA SOURCES

Use free sources only.

Economic Events:

* Federal Reserve Calendar
* BLS CPI Schedule
* FRED
* Trading Economics

Market Data:

* Twelve Data
* Finnhub fallback

Asset focus:

XAUUSD only

Optional supporting context:

* DXY
* US 2Y Yield
* US 10Y Yield

---

# DASHBOARD DESIGN

Use the attached screenshot as inspiration.

Create a dramatically improved version.

Design style:

Bloomberg Terminal x Apple x Notion x Linear

Theme:

Dark

Background:

#0B1020

Cards:

#121827

Accent:

#3B82F6

Bullish:

#10B981

Bearish:

#EF4444

Warning:

#F59E0B

Critical:

#DC2626

---

# ANIMATIONS

Use Framer Motion extensively.

Requirements:

Dashboard Load:

* stagger animation
* spring transitions
* fade + slide

Price Updates:

* smooth number transitions
* green flash on increase
* red flash on decrease

Alert Arrival:

* slide from top
* glow effect
* pulse

Market Score:

* animated gauge
* smooth transitions

Session Countdown:

* live countdown
* updates every second

Cards:

* hover elevation
* subtle parallax
* glassmorphism

Create a premium experience.

---

# DASHBOARD LAYOUT

Top Header

Contains:

* Gold FX War Room
* Current Time
* Current Session
* Market Status
* Notification Status
* Profile

---

# HERO ALERT BAR

Sticky top component.

Examples:

🚨 CPI IN 15 MINUTES

🚨 GOLD BROKE ASIAN HIGH

🚨 FOMC STARTS IN 30 MINUTES

Animated ticker effect.

---

# WIDGETS

## Widget 1

Market Overview

Show:

XAUUSD

Display:

* Current Price
* Daily Change
* Daily Range
* Trend
* Mini Chart

---

## Widget 2

Market Score

Generate:

0-100 score

Show:

Bullish Score

Factors:

* Above Asian High
* London Open
* DXY Weakness

Risks:

* CPI in 45 minutes

Use animated radial gauge.

---

## Widget 3

Session Monitor

Sessions:

* Tokyo
* London
* New York

Display:

* Open
* Close
* Countdown
* Current Session
* Overlap Status

Generate alerts:

60 min
15 min
5 min

before open.

---

## Widget 4

Economic Calendar

Show:

* Event
* Impact
* Forecast
* Previous
* Countdown

Only show:

High
Critical

events.

---

## Widget 5

Market Intelligence

Show:

* Liquidity Sweep
* Volatility Spike
* Range Breakout
* Trend Shift
* Sharp Move

Each item:

* Timestamp
* Confidence Score
* Impact
* Summary

---

## Widget 6

Daily Briefing

Generated daily.

Contains:

* Bias
* Support
* Resistance
* Key Events
* Volatility Forecast
* Best Trading Window

---

## Widget 7

War Room Timeline

Chronological feed:

09:30 London Open

10:15 Gold broke Asian High

10:32 DXY weakness detected

11:00 CPI in 60 min

11:45 CPI in 15 min

Newest items appear with animation.

---

# ALERT TYPES

Session Alerts

Examples:

London opens in 5 minutes.

New York opens in 15 minutes.

---

Economic Alerts

Examples:

CPI in 15 minutes.

NFP in 1 hour.

Fed speech begins in 10 minutes.

---

Price Alerts

Examples:

Gold broke Asian High.

Gold broke Yesterday Low.

Weekly High Break.

---

Market Intelligence

Examples:

Volatility spike detected.

Liquidity sweep detected.

Range expansion detected.

---

Daily Briefing

07:00 SGT

Evening Briefing

20:00 SGT

---

# INTELLIGENCE ENGINE

Prioritize deterministic rules.

Do NOT use AI for:

* Session alerts
* Scheduled reminders
* Basic price alerts

Only use Bedrock Nova Micro for:

* FOMC summaries
* Fed speech summaries
* Major macroeconomic interpretation

Keep AI usage minimal.

Target Bedrock cost:

Less than USD 5/month.

---

# AWS ARCHITECTURE

CloudFront
↓
S3
↓
Next.js PWA

API Gateway
↓
Lambda
↓
DynamoDB

EventBridge
↓
Alert Engine

Bedrock
↓
Macro Summaries

CloudWatch
↓
Monitoring

Telegram
↓
Backup Alerts

---

# RELIABILITY

Implement:

* Retry logic
* Circuit breakers
* Alert deduplication
* Notification queue
* Offline support
* Background sync
* Local cache

Maximum:

20 alerts/day unless critical.

Avoid notification spam.

---

# COST TARGET

AWS Cost:

Less than USD 10/month.

Use free tiers whenever possible.

No always-on servers.

No EC2.

No Kubernetes.

---

# DELIVERABLES

Generate:

1. AWS CDK infrastructure
2. DynamoDB schema
3. Lambda functions
4. EventBridge schedules
5. Cognito passkey setup
6. Web Push implementation
7. Service Worker
8. Next.js application
9. Framer Motion animations
10. Production deployment guide

All code must be production-ready, secure, scalable, and enterprise-quality.
