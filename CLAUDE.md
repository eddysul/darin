# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Darin** — a postpartum care specialist (산후조리사) matching and newborn/mother care recording platform for Korean/Korean-American families in the US. Families register, browse caregivers by cultural fit and preferences, send quote requests, and once matched use the app to track baby and mother daily care. DS teammates own the FastAPI backend and AI suggestion logic.

## Architecture

```
darin/
├── frontend/                        # Expo (React Native) app
│   ├── app/                         # Expo Router screens
│   │   ├── index.tsx                # Role selector: 가족 / 산후조리사
│   │   ├── (family)/                # Family screens
│   │   └── (caregiver)/             # Caregiver screens + log forms
│   ├── constants/api.ts             # API_BASE_URL — swap this for demo
│   ├── context/AppContext.tsx       # Role + match state (no real auth)
│   ├── components/                  # Shared UI components
│   └── package.json
└── backend/                         # FastAPI app (DS teammates)
    ├── app/
    │   ├── main.py                  # FastAPI entry point + CORS
    │   ├── config.py                # Settings from .env
    │   └── services/                # AI suggestion logic goes here
    ├── requirements.txt
    └── .env                         # API keys (git-ignored)
```

## Commands

```bash
# Frontend
cd frontend
npx expo start          # Start dev server, scan QR with Expo Go app

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Key Libraries

- **Expo Router** — file-based navigation (same mental model as Next.js)
- **NativeWind** — Tailwind CSS classes in React Native (`className="..."`)

## MVP Scope

Simulates one fixed family + one fixed caregiver + one baby. No real auth — role is selected on the home screen and stored in React Context. Matching filters are UI-only (results come from seeded fake data). AI suggestions come from `GET /suggestions` on the FastAPI backend.

## API Contract (FastAPI base URL in `constants/api.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/caregivers` | List caregivers. Params: `language`, `experience`, `live_in`, `budget_max` |
| GET | `/caregivers/:id` | Caregiver profile detail |
| POST | `/quotes` | Send quote request `{ family_id, caregiver_id }` |
| PATCH | `/quotes/:id/accept` | Caregiver accepts quote |
| GET | `/logs?date=` | All care logs for a date |
| POST | `/logs` | Add log `{ category, type, timestamp, data }` |
| GET | `/suggestions` | AI suggestion string |

## Bilingual Text Convention

Labels are inline bilingual — no i18n library:
```
"Feeding / 수유"   "Sleep / 수면"   "Request Quote / 견적 요청"
```

## Branch Strategy

- `dev` — Min Gyu (mobile)
- Each teammate has their own branch; merge directly to `main` when stable
