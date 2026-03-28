# Audio Blog Platform

音声配信・ブログ統合プラットフォーム

## Overview

A text-to-speech audio streaming and blog CMS marketplace. Creators publish written content that is automatically converted to audio via Google Cloud TTS, and listeners can discover, stream, and purchase content through an integrated Stripe-powered marketplace.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, Firebase Auth, Stripe.js |
| **Backend** | Python 3.11+, FastAPI, Firestore, Google Cloud TTS, Stripe Connect |
| **Infrastructure** | Docker, Firebase, Google Cloud (Cloud Run, Cloud Storage), Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (for TTS and Cloud Storage)

### Local Development

```bash
# Clone
git clone https://github.com/marbeau17/audio-blog-platform.git
cd audio-blog-platform

# Backend
cd backend
cp .env.example .env          # Edit with your credentials
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Frontend (in a separate terminal)
cd frontend
cp .env.example .env.local    # Edit with your credentials
npm install
npm run dev

# Docker (full stack - alternative to above)
docker-compose up
```

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password, Google sign-in)
3. Enable **Firestore** database
4. Generate a service account key and place it in `backend/serviceAccountKey.json`
5. Update `.env` / `.env.local` files with your Firebase config values

## Project Structure

```
audio-blog-platform/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── core/           # Config, dependencies
│   │   ├── middleware/      # Auth, CORS, etc.
│   │   ├── models/         # Firestore document models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (TTS, Stripe, etc.)
│   │   └── main.py         # FastAPI entrypoint
│   ├── tests/
│   ├── scripts/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries (Firebase, API client)
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript type definitions
│   ├── public/
│   └── vercel.json
├── infrastructure/
│   └── firebase/           # Firebase config & rules
├── docker-compose.yml
└── README.md
```

## API Documentation

Once the backend is running, interactive API docs are available at:

- **Swagger UI:** [http://localhost:8080/docs](http://localhost:8080/docs)
- **ReDoc:** [http://localhost:8080/redoc](http://localhost:8080/redoc)

## Features

- **Content Management** -- Creators write and manage blog posts via a rich CMS
- **Text-to-Speech** -- Automatic audio generation using Google Cloud TTS
- **Audio Streaming** -- Listeners stream audio content with a built-in player
- **Marketplace** -- Paid content with Stripe Connect for creator payouts
- **Authentication** -- Firebase Auth with email/password and Google sign-in
- **Creator Dashboard** -- Analytics and content management for creators

## Deployment

| Service | Platform | Config |
|---|---|---|
| Frontend | Vercel | `frontend/vercel.json` |
| Backend | Google Cloud Run | `backend/Dockerfile`, `backend/cloudbuild.yaml` |
| Database | Firebase Firestore | `infrastructure/firebase/` |
