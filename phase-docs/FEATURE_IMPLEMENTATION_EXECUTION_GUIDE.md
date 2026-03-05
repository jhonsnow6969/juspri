# DirectPrint Feature Implementation Execution Guide

This document translates the v2.0 master plan into an execution-ready backlog with clear acceptance criteria, sequencing, API contracts, and definition-of-done checks.

## 1) Recommended build order

1. **Phase 1: Print Stability (must finish first)**
2. **Phase 2: Manual Duplex**
3. **Phase 3: Scanning (eSCL/AirScan)**
4. **Phase 4: Xerox/Copy (depends on P2 + P3)**
5. **Phase 5: Admin Config (can run in parallel after contracts are fixed)**

---

## 2) Cross-phase contracts (define first)

Lock these contracts before implementation to prevent frontend/backend/pi-agent drift.

### Job types
- `print`
- `duplex`
- `scan`
- `xerox`

### Canonical job states
- Shared: `queued`, `in_progress`, `completed`, `failed`, `cancelled`
- Duplex: `printing_pass_1`, `waiting_for_flip`, `printing_pass_2`
- Scan: `discovering_scanner`, `scanning`, `processing`
- Xerox: `scanning_original`, `processing_copy`, `printing_copy`

### WebSocket event names
- `job:state_changed`
- `job:error`
- `job:completed`
- `duplex:waiting_for_flip`
- `duplex:flip_confirmed`
- `scan:completed`
- `config:updated`

### Minimum DB metadata shape (`jobs.metadata` JSONB)
```json
{
  "job_type": "print|duplex|scan|xerox",
  "current_pass": 1,
  "scan_options": {
    "color_mode": "color|bw",
    "dpi": 300,
    "format": "pdf|png|jpeg",
    "page_size": "A4"
  },
  "xerox_options": {
    "copies": 1,
    "duplex": false,
    "color_mode": "color"
  },
  "error_code": "PRINTER_OFFLINE",
  "error_message": "Printer is offline"
}
```

---

## 3) Phase-by-phase execution checklist

## Phase 1 — Stabilize print pipeline

### Backend
- [ ] Ensure single source of truth for job status transitions.
- [ ] Validate job ID consistency across REST + WS + DB.
- [ ] Add status polling fallback endpoint for frontend resiliency.
- [ ] Add reconnect/replay handling for Pi socket drops.

### Pi agent
- [ ] Emit lifecycle events for every transition.
- [ ] Add timeout guard when CUPS stalls.
- [ ] Surface readable printer errors.
- [ ] Add per-printer queue lock to prevent overlapping jobs.

### Frontend
- [ ] Render realtime state timeline, not only "submitted".
- [ ] Gracefully handle socket disconnect/reconnect.
- [ ] Show structured error banners for common failure classes.

### Database
- [ ] Confirm `jobs` has base fields.
- [ ] Add `metadata JSONB` if missing.
- [ ] Add index `(kiosk_id, status)`.

### Phase 1 acceptance tests
- [ ] Printer online: job completes with full state progression in UI.
- [ ] Printer offline: user gets explicit error within timeout window.
- [ ] Socket drop during print: UI recovers and receives final state.

---

## Phase 2 — Manual duplex

### Backend
- [ ] Accept `job_type=duplex` on job creation.
- [ ] Add `POST /jobs/:id/confirm-flip`.
- [ ] Persist `current_pass` and transitions.

### Pi agent
- [ ] Split pages odd/even-reversed using `ghostscript` or `pdftk-java`.
- [ ] Insert blank page for odd-page documents.
- [ ] Pause after pass 1 and wait for explicit flip confirmation.
- [ ] Support cancellation while waiting for flip.

### Frontend
- [ ] Duplex toggle in print options.
- [ ] Blocking flip modal + continue/cancel actions.
- [ ] Live pass state (1/2) and completion transitions.

### Phase 2 acceptance tests
- [ ] 4-page PDF aligns correctly front/back.
- [ ] 5-page PDF inserts blank correctly.
- [ ] Cancel during `waiting_for_flip` transitions to `cancelled`.

---

## Phase 3 — Scanning via eSCL

### Backend
- [ ] Add `POST /jobs/scan`.
- [ ] Add `POST /jobs/:id/scan-upload`.
- [ ] Emit `scan:completed` with download URL.
- [ ] Implement expiry cleanup for scan files.

### Pi agent
- [ ] Add `scanner.js` for eSCL discovery + scan lifecycle.
- [ ] Discover scanner via mDNS `_uscan._tcp` with printer-IP fallback.
- [ ] Cache capabilities and validate requested settings.
- [ ] Convert image output to PDF when required.

### Frontend
- [ ] Add scan mode + options form.
- [ ] Show scan lifecycle states.
- [ ] Show download CTA on completion.

### Phase 3 acceptance tests
- [ ] `GET /eSCL/ScannerCapabilities` reachable from Pi.
- [ ] Scan job completes and file is downloadable.
- [ ] Timeout path returns explicit actionable error.

---

## Phase 4 — Xerox/copy orchestration

### Backend
- [ ] Accept `job_type=xerox`.
- [ ] Pass copy options to Pi (`copies`, `duplex`, `color`).

### Pi agent
- [ ] Implement `handleXeroxJob()` orchestrator.
- [ ] Reuse scan module from Phase 3.
- [ ] Route to duplex or single-sided print path.
- [ ] Cleanup intermediate files.

### Frontend
- [ ] Add "Copy/Xerox" mode.
- [ ] Combined progress UX: scan -> print copies.
- [ ] Reuse duplex flip modal when needed.

### Phase 4 acceptance tests
- [ ] Single copy works end-to-end.
- [ ] N copies run with correct state transitions.
- [ ] Duplex copy uses flip workflow successfully.

---

## Phase 5 — Admin config panel

### Backend
- [ ] Add `GET/PUT /admin/kiosks/:id/config`.
- [ ] Persist config in `kiosk_config` JSONB.
- [ ] Push `config:updated` over WS.

### Pi agent
- [ ] Load config on startup.
- [ ] Hot-reload config from websocket updates.
- [ ] Enforce capability gating by config.

### Frontend (Admin)
- [ ] Feature flags per kiosk (print/scan/xerox/duplex).
- [ ] Capability flags (duplex support, formats, max DPI).
- [ ] Live kiosk status + job history filters.

### Phase 5 acceptance tests
- [ ] Disable scan in admin and verify scan jobs are rejected.
- [ ] Update max DPI and verify UI options update.
- [ ] Config changes apply without Pi restart.

---

## 4) Two-week execution starter plan

### Week 1
- Day 1–2: Lock job contracts (types, states, WS payloads).
- Day 3–4: Complete Phase 1 backend + Pi reliability changes.
- Day 5: Frontend reliability pass and end-to-end validation.

### Week 2
- Day 1–3: Build duplex backend + Pi split/flip flow.
- Day 4–5: Duplex frontend modal UX + hardware test calibration.

---

## 5) Immediate next actions for your current repo

1. Confirm current `jobs` schema supports `metadata JSONB` and fast polling index.
2. Audit `backend/modules/socket-manager.js` for reconnect + event replay behavior.
3. Add/verify clear state transitions in Pi agent print lifecycle.
4. Run a manual hardware test matrix:
   - printer online/offline
   - paper out
   - duplex 4-page and 5-page documents

When these are stable, start Phase 3 scanner module implementation.
