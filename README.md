# Voico Calls Dashboard

A full-stack interview project built with FastAPI + SQLite on the backend and React + TypeScript on the frontend. It displays a real-time dashboard of phone calls with status tracking.

---

## Architecture

```
voico-test-interview/
  backend/    FastAPI + SQLModel + SQLite + Alembic
  frontend/   React + Vite + TypeScript + Tailwind CSS + TanStack Query
```

---

## Backend

**Stack:** Python 3.12, FastAPI, SQLModel, SQLite (aiosqlite), Alembic

### Setup

```bash
cd backend

# Install dependencies
uv sync

# Copy environment file
cp .env.example .env

# Start the development server
uv run uvicorn app.main:app --reload --port 8000
```

The database (`db.sqlite3`) is included in the repo and already contains 100 sample calls — no migrations or seeding needed to get started.

### Migrations

```bash
# Apply all pending migrations
uv run alembic upgrade head

# Create a new migration (after changing a model)
uv run alembic revision --autogenerate -m "your_message"
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calls` | List calls (filterable by status, paginated) |
| `GET` | `/api/calls/{id}` | Get single call |
| `PATCH` | `/api/calls/{id}/notes` | Update notes on a call — to be implemented in Task 1 |
| `POST` | `/api/webhook/call` | Update an existing call (status, duration, transcript, end time) — to be implemented in Task 4 |
| `GET` | `/health` | Health check |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite database path (default: `sqlite+aiosqlite:///./db.sqlite3`) |
| `OPENAI_API_KEY` | OpenAI API key — needed for Task 4 |
| `STALE_CHECK_INTERVAL_MINUTES` | How often the auto-expiry job runs (default: `10`) — Task 3 |
| `STALE_THRESHOLD_MINUTES` | How long a call may stay `in_progress` before being expired (default: `30`) — Task 3 |

---

## Frontend

**Stack:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, axios, lucide-react, date-fns

### Setup

```bash
cd frontend

npm install
npm run dev
```

The UI will be available at `http://localhost:5173`.

### Environment Variables

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:8000` |

---

## Development Notes

- All Python code is fully async (FastAPI + SQLModel async)
- Database interactions use `session.flush()` — commits are handled by the `@session_manager` decorator at the router level
- CORS is open for all origins (demo project)
- No authentication

---

## Interview Tasks

There are four features to implement. Some tasks require adding new endpoints and fields from scratch; others have the structure already in place and just need the logic filled in.

---

### Task 1 — Call Notes

**What exists:** The `Call` model has no notes field. There is no way for a user to annotate a call.

**What to build:** Add a `notes` field to the `Call` model — a nullable free-text field. Create an Alembic migration for it. Add a `PATCH /api/calls/{id}/notes` endpoint that accepts a JSON body `{"notes": "..."}` and persists it. On the frontend, make the notes field editable inline inside the call detail drawer: clicking on it should turn it into a textarea, and saving should call the new endpoint and update the UI immediately.

**Solution:**

Backend:
- Added `notes: Optional[str]` to the `Call` model and to `CallResponse`, plus an `UpdateNotesPayload` request schema in `app/modules/calls/schema.py`.
- Created Alembic migration `0002_add_notes_to_calls.py` (`op.add_column("calls", ...)`), applied with `uv run alembic upgrade head`.
- Added `CallService.update_notes()` (404 if the call is missing, sets `notes` + `updated_at`) and a `PATCH /api/calls/{call_id}/notes` route. The route uses the existing `@session_manager` decorator (param named `session`) so the commit is handled at the router level, consistent with the rest of the codebase.

Frontend:
- Added `notes` to the `Call` type and a `callsApi.updateNotes()` axios call.
- Added a `NotesSection` to `CallDetailDrawer.tsx`: the note renders as a clickable area that turns into a `<textarea>` on click. Saving fires a `useMutation`; on success it invalidates the `["calls"]` query and, via a new `onCallUpdated` callback wired through `CallsPage`, updates the selected-call snapshot so the drawer reflects the change immediately (the drawer renders a snapshot, not a live query). Empty input is persisted as `null`.

---

### Task 2 — Advanced Filtering & Search

**What exists:** The table has tabs to filter by status. That's it.

**What to build:** A proper multi-filter system so users can narrow down calls using several conditions simultaneously.

On the **backend**, extend `GET /api/calls` to accept additional query parameters: partial match on caller name and phone number, exact match on label, min/max duration in seconds, and column sorting. All filters should be optional and combinable — multiple active filters are ANDed together.

On the **frontend**, add a filter UI that lets users add and remove filters. Each active filter should be visible as a removable chip or tag. Column headers should be clickable to sort ascending/descending (one active sort at a time). All active filters and sort state should be reflected in the API request in real time.

**Solution:**

Backend (`GET /api/calls`):
- Extended the router, `CallService.list_calls`, and `CallRepository.list_calls` with optional, combinable params: `caller_name` (case-insensitive partial match via `ilike`), `phone_number` (partial match with spaces stripped from both the stored value and the search term, so e.g. `142` matches `+33 1 42 68 00 01`), `label` (exact `CallLabel`), `min_duration`/`max_duration` (integer bounds), and `sort_by`/`sort_dir`.
- All conditions are collected into a list and ANDed onto both the data query and the count query. The previously hard-coded `order_by(Call.created_at.desc())` is replaced with dynamic ordering driven by a `SORTABLE_COLUMNS` whitelist (defaults to `created_at desc`), which prevents arbitrary/unsafe sort columns. `sort_dir` is validated with a regex pattern at the router. Status counts intentionally still reflect the whole table, not the active filters.

Frontend:
- Extended `CallsQueryParams` and added a `CallLabel` union + `SortableColumn`/`SortDir` types.
- New `CallsFilterBar` component: pick a field, enter a value (or choose a label from a dropdown), and add it; active filters render as removable chips with a "Clear all" option.
- `CallsTable` headers are now clickable `SortableHeader`s with asc/desc/neutral chevron indicators; clicking toggles direction, and only one sort is active at a time.
- Filter and sort state live in `CallsPage`, are part of the TanStack Query `queryKey`, and are passed into `callsApi.list()`, so changes refetch in real time. Page resets to 1 on any filter/sort change.

---

### Task 3 — Stale Call Auto-Expiry

**What exists:** The database contains calls with status `in_progress`. They are meant to get updated to `success` or `failed` via the webhook. There is no mechanism to handle calls that never receive a closing webhook.

**What to build:** A background job that runs automatically while the server is up. Every 10 minutes it checks for calls that have been `in_progress` for more than 30 minutes and marks them as `failed` in a single batch update. It should log how many calls were expired each run.

The interval (10 min) and the stale threshold (30 min) must be configurable via environment variables — add them to `.env` and `app/core/config.py` so they are easy to adjust for testing without touching the code.

**Solution:**

- Added `stale_check_interval_minutes` (default 10) and `stale_threshold_minutes` (default 30) to `Settings` in `app/core/config.py`, plus `STALE_CHECK_INTERVAL_MINUTES`/`STALE_THRESHOLD_MINUTES` in `.env` and `.env.example`.
- Implemented the job in `app/modules/calls/tasks.py`: `expire_stale_calls()` runs a single batch `UPDATE` that flips every `in_progress` call older than the threshold to `failed`, commits, and returns the row count. `stale_calls_loop()` runs it forever, sleeping `interval` minutes between runs and logging how many calls were expired each run. The loop catches and logs exceptions so a single failure does not kill it, and handles cancellation cleanly.
- Wired into the app via a FastAPI `lifespan` handler in `app/main.py`: the loop is launched with `asyncio.create_task` on startup and cancelled on shutdown. A fresh `async_session` is opened per run since there is no request-scoped session in a background task.

---

### Task 4 — Webhook AI Integration

**What exists:** The `POST /api/webhook/call` endpoint exists with a `pass` body. The `CallLabel` enum is defined in `schema.py`. The webhook payload accepts `call_id`, `status`, `duration_seconds`, `raw_transcript`, and `ended_at`.

**What to build:** Implement the `POST /api/webhook/call` endpoint. It has two responsibilities:

1. **Update the call** — find the call by `call_id`, update its `status`, `duration_seconds`, `raw_transcript`, and `ended_at`, then persist the changes.
2. **AI enrichment** — if the new status is `success` or `failed` and a `raw_transcript` is provided, call the OpenAI API (`gpt-4o-mini`) to generate a short summary (2–3 sentences) and classify the call into one of the `CallLabel` values. Store both on the call record. If the OpenAI call fails, log the error and continue — `summary` and `label` should remain `null`.

**Solution:**

- Implemented `webhook_call` by delegating to a new `CallService.process_webhook()`: it finds the call by `call_id` (404 if missing), updates `status`, `duration_seconds`, `raw_transcript`, and `ended_at` (only overwriting fields that were provided), and persists via the repository. The route keeps the existing `@session_manager` decorator so the commit happens at the router level.
- AI enrichment is isolated in `app/modules/calls/ai.py` (`enrich_transcript`). When the new status is `success`/`failed` and a transcript is present, it calls `gpt-4o-mini` with JSON response mode, asking for a 2–3 sentence summary and a label constrained to the exact `CallLabel` values. The returned label is parsed back into the enum (case-tolerant) and ignored if it doesn't match. Any failure — missing API key, network/API error, or bad output — is logged and swallowed, leaving `summary` and `label` as `null` so the call update still succeeds.

**How to test:** Once implemented, use the interactive API docs at `http://localhost:8000/docs` (powered by Swagger UI). Steps:
1. Call `GET /api/calls?status=in_progress` and copy an `id` from the response.
2. Open `POST /api/webhook/call`, click **Try it out**, and paste a payload like:
   ```json
   {
     "call_id": "<paste id here>",
     "status": "success",
     "duration_seconds": 120,
     "ended_at": "2024-01-01T12:00:00",
     "raw_transcript": "Agent: How can I help?\nCaller: I need to upgrade my plan."
   }
   ```
3. Hit **Execute** — the response will show the updated call with the generated summary and label.
