# Appergy Scanner

Food allergen scanner app — snap a photo of any ingredient label and instantly check it against your allergy profile.

## Architecture

```
┌─────────────────┐       ┌──────────────────────────────┐
│  Expo / React   │──────▶│  Express Server (Railway)    │
│  Native App     │ POST  │                              │
│  (iOS/Android)  │◀──────│  Phase 1: OpenAI Vision OCR  │
│                 │  JSON │  Phase 2: Deterministic       │
│  Firebase Auth  │       │          Rule Engine          │
│  Firestore DB   │       │                              │
└─────────────────┘       └──────────────────────────────┘
```

- **Client**: Expo/React Native app with camera, profile management, recipe generation
- **Server**: Express API on Railway — OCR via OpenAI Vision, then deterministic allergen/dietary checks
- **Database**: Firebase Firestore (user profiles, family members, saved recipes)
- **AI**: OpenAI only does OCR (reading text). Safety decisions are 100% deterministic rule matching.

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/appergy-scanner.git
cd appergy-scanner
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_DOMAIN to your Railway server URL
```

### 3. Run Locally

**Expo (mobile app):**
```bash
npm run expo:dev
```

**Server (API):**
```bash
OPENAI_API_KEY=sk-... npm run server:dev
```

## Deploy Server to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Add environment variable: `OPENAI_API_KEY` = your OpenAI key
5. Railway auto-detects `railway.toml` and deploys
6. Get your URL from Settings → Domains (e.g. `appergy-production.up.railway.app`)
7. Set `EXPO_PUBLIC_DOMAIN=appergy-production.up.railway.app` in your local `.env`
8. Restart Expo: `npm run expo:dev`

## Project Structure

```
├── client/                  # React Native / Expo app
│   ├── screens/             # 25 screens
│   ├── components/          # Shared UI components
│   ├── contexts/            # AuthContext (profiles, auth state)
│   ├── navigation/          # Tab and stack navigators
│   └── services/            # Engine, AI client, Firebase
├── server/                  # Express API server
│   ├── index.ts             # Entry point
│   ├── routes.ts            # API endpoints
│   └── services/analysis.ts # OCR + engine pipeline
├── shared/                  # Types shared between client and server
├── railway.toml             # Railway deployment config
├── firestore.rules          # Firestore security rules
└── .env.example             # Environment variable template
```

## Tech Stack

Expo SDK 54, React Native, React Navigation 7, Express, TypeScript, OpenAI Vision (GPT-4o), Firebase Auth, Cloud Firestore, Railway
