# BorderPulse

Real-time US-Mexico border crossing wait times, historical patterns, and predictions. Built for people who actually cross the border — commuters, families, truckers.

Data sourced from the [CBP Border Wait Times API](https://bwt.cbp.gov/), updated every ~15 minutes.

---

## Quick Start

### Docker

```bash
cp .env.example .env
docker-compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Manual

**Prerequisites:** Python 3.11+, Node.js 20+, PostgreSQL 16 + TimescaleDB, Redis

See the Redis setup section below if you don't have Redis running.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.seed_db
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

---

## Redis Setup

Redis caches live wait times so the API responds fast. The app works without it (falls back to PostgreSQL) but responses are slower.

**macOS:** `brew install redis && brew services start redis`

**Linux:** `sudo apt install redis-server && sudo systemctl start redis`

**Windows:** Redis doesn't run natively. Use Docker (`docker run -d -p 6379:6379 redis:7-alpine`), WSL2, or [Memurai](https://www.memurai.com/).

---

## How It Works

The backend polls CBP every 5 minutes, normalizes the data, deduplicates it, and stores observations in a TimescaleDB hypertable. The API serves live wait times from Redis, and the frontend auto-refreshes every 60 seconds.

Predictions are kernel-smoothed weighted medians over the last 90 days of observations. Each historical sample contributes weight ≈ `recency × hour_kernel × dow_kernel × holiday_match`:

- **Recency**: exponential decay with a 21-day half-life, so recent patterns dominate.
- **Hour kernel**: Gaussian over cyclic hour distance (σ=1h) — hour 14 borrows strength from 13 and 15.
- **Day-of-week kernel**: same dow weighted 1.0; adjacent same-group (e.g., Mon↔Tue) 0.45; cross-group (weekday↔weekend) 0.07.
- **Holiday match**: predictions for non-holidays downweight observations from holidays (and vice versa). Major US/MX holidays and Semana Santa are detected automatically; the response includes an `isHoliday` flag.

Confidence is set by the Kish effective sample size and the IQR-to-prediction ratio. For "today", the next 3 hours are nowcast-blended with the current live wait — if the border is running 30 min above baseline right now, the next hour gets +27, two hours out +20, decaying back to baseline.

---

## Current Limitations

- **CBP data quality varies.** Some ports report "Update Pending" for hours, especially overnight. Nothing we can do about that.

---

## Covered Crossings

23 ports across CA, AZ, and TX: San Ysidro, Otay Mesa, Calexico West/East, Tecate, Andrade, CBX, Nogales DeConcini/Mariposa, Douglas, Lukeville, San Luis, El Paso (BOTA, Stanton, Ysleta), Laredo (WTB, Gateway), Hidalgo, Brownsville (Gateway, Veterans), Eagle Pass, Del Rio, Presidio.


