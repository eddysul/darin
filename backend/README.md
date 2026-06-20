# Darin — Backend (FastAPI)

## Setup

```bash
cd backend
pip install fastapi uvicorn sqlalchemy
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints needed by the mobile app

| Method | Path | Description |
|--------|------|-------------|
| GET | `/caregivers` | List caregivers. Query params: `language`, `experience`, `live_in`, `budget_max` |
| GET | `/caregivers/{id}` | Single caregiver profile |
| POST | `/quotes` | `{ family_id, caregiver_id }` — send quote request |
| PATCH | `/quotes/{id}/accept` | Caregiver accepts a quote |
| GET | `/logs` | All logs. Query param: `date` (YYYY-MM-DD) |
| POST | `/logs` | Add log entry |
| GET | `/suggestions` | Returns `{ suggestion: "..." }` string from AI |

## Log entry schema

```json
{
  "category": "baby" | "mother",
  "type": "feeding" | "sleep" | "diaper" | "growth" | "meal" | "rest",
  "timestamp": "2026-06-20T10:30:00Z",
  "data": {}
}
```

## Seed data required

- 5-6 caregiver profiles with varied: language, experience, live_in, price, location
- 2-3 pre-existing log entries for today (so family dashboard isn't empty on demo)
