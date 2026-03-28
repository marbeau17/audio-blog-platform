# Audio Blog Platform - 音声配信・ブログ統合プラットフォーム

## Architecture

```
├── backend/          # FastAPI Backend (Python 3.11+)
├── frontend/         # Next.js 14 Frontend
├── infrastructure/   # Docker, Firebase, GCP configs
└── .github/          # CI/CD Workflows
```

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** Python 3.11 + FastAPI
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **TTS:** Google Cloud Text-to-Speech
- **Storage:** Google Cloud Storage
- **Payments:** Stripe Connect
- **Hosting:** Vercel (FE) + Cloud Run (BE)
