# Bron PRD

**Document:** `prd.md`  
**Product:** Bron (Personal AI Agents / “Brons”)  
**Version:** 0.1 (Demo MVP)  
**Date:** 2025-12-14  
**Owner:** Sami  
**Status:** Draft  

---

## 1. Summary

Bron is a web application that lets users create persistent personal AI agents (“Brons”) that can execute background tasks. A user chats to define a task; Bron spawns a run (optionally with child Brons) that works in the background, streams progress updates, and produces structured, “generative UI” outputs (cards) plus artifacts.

This PRD covers the **Demo MVP** focusing on a high-impact non-coding scenario:

> **Gmail Demo:** Search Gmail for a specific email, download an attachment, extract key info, draft an outgoing email, and send it **only after user approval**.

The MVP runs **entirely on Vercel**, uses **Next.js Route Handlers** for API, and uses **Claude Agent SDK** in a **Vercel Sandbox** invoked from a background **Vercel Workflow**.

---

## 2. Goals

### 2.1 Product Goals
- Enable a user to create multiple Brons and assign tasks via chat.
- Provide two primary views:
  1) **Chat / Run view**: interactive task creation + streamed progress + rich UI cards.
  2) **Brons list view**: list of Brons with colored avatar placeholders, current status, and latest result preview.
- Support “background-feeling” execution: runs that continue after the user navigates away, with resumable UI updates via event streaming.
- Demonstrate multi-agent behavior: a “manager” Bron can spawn child Brons for subtasks and combine results.
- Integrate with Gmail (OAuth) for search/read/attachments and sending emails with a human approval gate.
- Use Skills (filesystem-based `.claude/skills`) to standardize task behaviors and outputs.

### 2.2 Technical Goals
- **Vercel-only** deployment for demo: no external workers.
- Runs are **independent** (no persistent filesystem); persistence is **memory summary + transcript + run events**.
- Strong safety posture:
  - No automatic sending email without explicit user approval.
  - Enforce tool-level safeguards even if the model attempts to bypass.

---

## 3. Non-Goals (Demo MVP)

- Multi-user support (beyond a single authenticated demo user).
- Team/shared Brons.
- Persistent Bron filesystem/workspaces across runs.
- Long-term scheduling / cron-based tasks (can be a Phase 2).
- Full-blown document OCR pipeline (use text-based extraction and PDF parsing where possible; OCR optional).
- Advanced permissions UI (fine-grained tool policies beyond “approval gate for send”).

---

## 4. Users & Personas

### 4.1 Primary Persona
- **Sami (Demo user)**: wants to showcase a “background agent” webapp with believable real-world tasks.

### 4.2 Secondary Persona (Future)
- Knowledge workers who want repeatable “agent workflows” (triage documents, summarize, draft communications).

---

## 5. Core Concepts & Definitions

- **Bron**: a named personal agent configuration (persona + tool policy + skills). “Persistent” means:
  - Stored **memory summary**
  - Stored **transcript** (and/or rolling summary)
  - Not a persistent running process

- **Run**: one execution of a task using a Bron (and optional child runs).
- **Child Run**: a run created by another run for a subtask (fan-out/fan-in).
- **Run Events**: append-only stream of progress, tool calls, UI cards, and artifacts.
- **Generative UI**: structured UI “cards” emitted during execution and rendered in the client.
- **Skills**: standardized, reusable instructions living in `.claude/skills/**/SKILL.md` to guide consistent agent behavior and output formats.

---

## 6. Product Requirements

### 6.1 Brons List View (Overview)
**User story:** As a user, I want to see all my Brons and what they’re doing at a glance.

**Must have:**
- List of Brons with:
  - Colored avatar placeholder
  - Bron name
  - Current status (Idle / Running / Needs Approval / Completed / Failed)
  - Latest run title/summary
  - Timestamp of last activity
  - Mini-preview of latest UI card (e.g., “Draft ready”)
- Click a Bron to open its details (or most recent run).

**Nice to have:**
- Filter by status.
- “Spawn new task” button per Bron.

### 6.2 Chat / Run View
**User story:** As a user, I want to describe a task conversationally and watch the Bron execute it with clear progress.

**Must have:**
- Chat composer (task prompt input)
- Run timeline feed:
  - Status transitions
  - Logs (“Searching Gmail…”, “Downloading attachment…”)
  - UI cards (tables/checklists/drafts)
- Ability to navigate away and return, still seeing the run state.
- If run produces an email draft card:
  - Show “Send” button to approve sending
  - Show “Edit” option (optional for MVP; can be “copy to clipboard”)

### 6.3 Gmail Demo Task
**User story:** As a user, I want a Bron to find a specific email, extract attachment info, and prepare an outgoing email, then send it after approval.

**Must have steps (agent-visible):**
1) Search Gmail with query (subject/from/has:attachment/date range).
2) Retrieve message and attachment metadata.
3) Download attachment(s).
4) Extract structured information from attachment(s).
5) Prepare an email draft with extracted info and context.
6) Wait for explicit approval to send.
7) Send the email via Gmail API.
8) Confirm success and store sent messageId.

**Outputs (user-visible):**
- Search Results Card (which message matched and why)
- Attachment Summary Card (file name, type, size)
- Extracted Fields Table (structured key-value data)
- Email Draft Card (to/subject/body preview)
- Final confirmation card (sent messageId, timestamp)

**Constraints:**
- Never send without approval.
- Default to draft creation; sending requires a one-time approval token.

---

## 7. Information Architecture

### 7.1 Routes / Pages
- `/` : Main chat view (latest run, create run)
- `/brons` : Brons list view
- `/brons/[bronId]` : Bron detail view (runs list + create run)
- `/runs/[runId]` : Run detail view (streamed events)

### 7.2 Navigation
- Primary nav: “Chat” | “Brons”
- Secondary within Bron detail: Runs history

---

## 8. System Architecture (Vercel-only)

### 8.1 Components
1) **Next.js Frontend (Vercel)**
   - Renders chat + brons list
   - Subscribes to run event stream
   - Handles Gmail OAuth connect button

2) **Next.js Route Handlers (Control Plane)**
   - Create runs, list brons/runs
   - Provide SSE stream of run events
   - Gmail OAuth endpoints
   - Approval endpoint to authorize send

3) **Vercel Workflow (Background Orchestration)**
   - Durable task execution with steps, retries, and observability
   - Invoked when a run is created
   - Can spawn child workflows for child runs

4) **Vercel Sandbox (Execution Isolation)**
   - Used per run to execute Claude Agent SDK runner and any parsing utilities
   - Downloads attachments into sandbox FS temporarily
   - Produces artifacts and uploads to Blob

5) **Storage**
   - **Postgres** (recommended: Neon/Supabase) for app data
   - **Vercel Blob** for uploads and generated artifacts

### 8.2 Run Lifecycle
- **Queued** → **Running** → **Needs Approval** (optional) → **Running** → **Succeeded**/**Failed**/**Canceled**

### 8.3 Event Streaming
- Worker writes `RunEvent` records as it progresses.
- Client connects to `GET /api/runs/:id/stream` SSE endpoint.
- Server streams events from DB (polling DB + flush to SSE).

### 8.4 How Vercel Workflow Invokes Vercel Sandbox (Implementation Detail)

**Key point:** Workflow does not have a special “run sandbox” primitive. A Workflow step is server-side code running in Vercel’s infrastructure; inside that step you invoke Sandbox via the **Sandbox SDK** (recommended) or HTTP API (rare).

**Recommended approach (SDK):**
1) Step calls `Sandbox.create()` to allocate an isolated execution environment (MicroVM).
2) Step calls `sandbox.runCommand(...)` (and optionally file operations) to run your agent runner.
3) Step calls `sandbox.stop()` to tear down the sandbox (best effort in `finally`).

**Auth model (Vercel-hosted):**
- When running on Vercel, the Sandbox SDK can use Vercel-provided identity (OIDC) automatically.
- For local development, you typically use Vercel CLI to populate env tokens (`vercel env pull`) and/or pass explicit token/project/team identifiers to the SDK.

**Longer/multi-step runs:**
- If you spread a run across multiple Workflow steps (or pause for human approval), store the `sandboxId` returned by `Sandbox.create()` in Workflow state, then later do `Sandbox.get(sandboxId)` and continue running commands.
- Be mindful of sandbox lifecycle limits; do not assume a sandbox can be kept alive indefinitely for “approval pending.” For approval gates, it’s usually better to stop the sandbox and resume later in a new sandbox (since this MVP does not require persistent filesystem).


### 8.5 Streaming transport decision (SSE vs WebSocket)

**Decision (Demo MVP): Use Server-Sent Events (SSE).**

**Why SSE**
- Run updates are **server → client only** (no need for bidirectional transport).
- SSE works well on Vercel as a streaming HTTP response when response buffering is avoided and function duration is sufficient (Fluid Compute). 
- SSE is simpler to implement than WebSockets and plays nicely with “reconnect and resume” semantics.

**Why not WebSockets (for Vercel-only MVP)**
- Long-lived WebSocket connections are not a great fit for Vercel Functions because functions have a maximum execution duration; keeping a WS connection alive beyond that isn’t possible in the general case.

**Implementation notes**
- Each `RunEvent` is emitted as an SSE event with:
  - `id: <seq>` (monotonic per run)
  - `event: <type>`
  - `data: <json>`
- On reconnect, the client sends `Last-Event-ID` so the server can resume from `seq + 1`.
- The server should emit heartbeat comments (e.g., `: ping`) every ~15–30 seconds to keep intermediaries from closing idle connections.


### 8.6 Offline mode and dropped-connection UX

The UI must remain usable when the event stream is interrupted.

**Client behavior**
- If SSE connection drops:
  - Show a non-blocking banner: “Reconnecting…”
  - Reconnect with exponential backoff (e.g., 0.5s → 1s → 2s → 5s → 10s, cap at 10s).
  - Include `Last-Event-ID` so the server can resume from the last received `seq`.
- If the browser is offline:
  - Show “Offline” status and pause reconnect attempts until online.
- If reconnect fails repeatedly (e.g., 1–2 minutes):
  - Fall back to polling `GET /api/runs/:id/events?afterSeq=...` every 2–5 seconds until SSE works again.

**Server behavior**
- The SSE endpoint should:
  - support `Last-Event-ID`
  - close idle connections after a fixed time (e.g., 15 minutes) and rely on the client to reconnect
  - emit heartbeats regularly

**Bron list view**
- Should always show *stale-but-valid* status from the last persisted DB state even without streaming.
- Indicate “Live updates paused” when offline.


### 8.7 Database connection strategy on Vercel (Specified)

**Goal:** avoid exhausting Postgres connections under serverless/Fluid Compute concurrency.

**Recommended patterns**
- If using `pg` / connection pools:
  - Create pool in module scope and attach to Vercel Functions so idle connections close before suspension.
- If using a provider-side pooler (PgBouncer) or a serverless HTTP driver:
  - Avoid “double pooling”; use the provider-recommended connection string/mode for serverless.

**For this MVP**
- Use a serverless-friendly driver/connection mode for Neon/Supabase, and keep DB operations short.
- Centralize all DB access in a small `db.ts` module so the strategy can be swapped later.


---

## 9. Data Model

### 9.1 Tables

#### `brons`
- `id` (uuid, pk)
- `name` (text)
- `avatar_color` (text)
- `system_prompt` (text)
- `memory_summary` (text) — rolling summary
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `runs`
- `id` (uuid, pk)
- `bron_id` (uuid, fk → brons.id)
- `parent_run_id` (uuid, nullable) — for child runs
- `title` (text)
- `prompt` (text)
- `status` (enum: queued|running|needs_approval|succeeded|failed|canceled)
- `approval_token_hash` (text, nullable)
- `created_at` (timestamp)
- `started_at` (timestamp, nullable)
- `finished_at` (timestamp, nullable)
- `error` (jsonb, nullable)

#### `run_events`
- `id` (bigserial, pk)
- `run_id` (uuid, indexed)
- `seq` (int) — monotonic per run
- `type` (enum: status|message|log|tool|ui|artifact|child_run)
- `payload` (jsonb)
- `created_at` (timestamp)

#### `uploads`
- `id` (uuid, pk)
- `run_id` (uuid, fk)
- `filename` (text)
- `content_type` (text)
- `blob_url` (text)
- `size_bytes` (bigint)
- `created_at` (timestamp)

#### `artifacts`
- `id` (uuid, pk)
- `run_id` (uuid, fk)
- `kind` (text) — e.g. extracted_json, pdf_summary, outbound_email_eml
- `blob_url` (text, nullable)
- `data` (jsonb, nullable)
- `created_at` (timestamp)


#### `bron_messages`
- `id` (bigserial, pk)
- `bron_id` (uuid, indexed)
- `run_id` (uuid, nullable) — link messages to the run that produced them
- `role` (enum: user|assistant|system|tool)
- `content` (text) — canonical transcript content
- `created_at` (timestamp)

**Notes**
- `run_events` remains the *operational log*; `bron_messages` is the *canonical transcript* used for context building and summarization.
- For MVP you may alternatively derive transcript from `run_events(type="message")`, but storing canonical messages simplifies truncation and summarization logic.

#### `oauth_tokens`
- `id` (uuid, pk)
- `provider` (enum: google)
- `user_id` (text) — for demo, single user
- `access_token` (text, encrypted)
- `refresh_token` (text, encrypted)
- `expiry` (timestamp)
- `scopes` (text[])
- `created_at` (timestamp)
- `updated_at` (timestamp)

> **Security note:** encrypt tokens at rest (KMS or libsodium/fernet). For demo, use a Vercel env key for encryption.

---

## 10. API Surface (Next Route Handlers)

### 10.1 Brons
- `GET /api/brons` → list
- `POST /api/brons` → create
- `GET /api/brons/:id` → detail
- `PATCH /api/brons/:id` → update memory/system prompt

### 10.2 Runs
- `POST /api/runs`
  - body: `{ bronId, title?, prompt, uploadIds? }`
  - creates run (queued), triggers workflow
- `GET /api/runs/:id` → run detail
- `GET /api/brons/:id/runs` → run history

### 10.3 Run events
- `GET /api/runs/:id/events?afterSeq=123` → polling JSON
- `GET /api/runs/:id/stream` → SSE

### 10.4 Uploads (Vercel Blob)
- `POST /api/uploads/token` → generate client upload token (Blob client upload)
- `POST /api/uploads/complete` → callback to associate upload with run

### 10.5 Gmail OAuth
- `GET /api/gmail/connect` → redirect to Google OAuth consent
- `GET /api/gmail/callback` → exchange code for tokens, store encrypted
- `POST /api/gmail/disconnect` → delete tokens

### 10.6 Approval gate
- `POST /api/runs/:id/approve-send`
  - body: `{ approved: true }`
  - sets approval token and updates run status to running (or unblocks tool usage)

### 10.7 Rate limiting (Demo MVP)

Rate limiting protects your DB, OAuth provider, and background execution from accidental loops or abuse. For a demo, implement per-user and per-IP throttles.

**Recommended implementation**
- Use a managed Redis-based limiter (e.g., Upstash Ratelimit) with a token-bucket or sliding-window strategy.
- Apply limits in Route Handlers for:
  - `POST /api/runs` (expensive: triggers background work)
  - `POST /api/gmail/connect` and `GET /api/gmail/callback` (protect OAuth endpoints)
  - `POST /api/runs/:id/approve-send` (protect send gate)
- Avoid hard-limiting `GET /api/runs/:id/stream` by request count; instead cap **concurrent connections** per user (e.g., 3) and enforce idle timeouts.

**Suggested default limits**
- `POST /api/runs`: 10/min per user, 30/min per IP
- `POST /api/runs/:id/approve-send`: 5/min per user
- `GET /api/gmail/connect`: 5/min per user
- `GET /api/runs/:id/stream`: max 3 concurrent SSE connections per user, close after 15 minutes and require reconnect

**Notes**
- Rate limiting inside Next.js still counts as an invocation; for “front-door” abuse protection you can optionally add a WAF/CDN rule later.
- All limits should return `429` with a UI-friendly error message and a `Retry-After` header when possible.


---

## 11. Execution: Claude Agent SDK Runner

### 11.1 Inputs per Run
- Bron config: `system_prompt`, `memory_summary`
- Transcript tail: last N user/assistant messages for that Bron (from DB)
- Run prompt: task description
- Attached uploads (optional)
- Gmail OAuth access token (refreshed server-side for the worker)

### 11.2 Outputs per Run
- `RunEvent`s (status/log/tool/ui)
- Artifacts (JSON extraction, PDF summary, EML draft)
- Updated Bron memory summary
- Updated transcript

### 11.3 Skills
Repo layout example:
```
.claude/
  skills/
    gmail_attachment_extractor/
      SKILL.md
    email_draft_writer/
      SKILL.md
    doc_info_extractor/
      SKILL.md
```

Skills expectations:
- Clear trigger conditions (“Use when task involves Gmail attachments…”)
- Step-by-step procedure
- Output schema requirements (for `emit_ui` cards)
- Safety rules (never send without approval, etc.)

SDK configuration:
### 11.11 Skills loading and discovery (Specified)

Skills are filesystem-based and must exist inside the sandbox filesystem at runtime.

**How the runner discovers Skills**
- The runner assumes the project root contains `.claude/skills/**/SKILL.md`.
- The runner ensures `settingSources: ["project"]` is set so the Agent SDK loads project settings/features.

**How Skills get into the sandbox**
Choose one of these patterns:

1) **Sandbox from repository (recommended for demo)**
   - Create the sandbox with a repository configured so the full project (including `.claude/skills`) is present when the sandbox boots.
   - Then run the agent runner command inside that repo directory.

2) **Write Skills into sandbox at runtime**
   - Bundle `.claude/skills` with your deployment.
   - On sandbox startup, write the directory tree into the sandbox filesystem before running the agent.

**Verification step**
- Before starting the agent, run a lightweight check in the sandbox to confirm Skills exist:
  - list `.claude/skills`
  - fail early with a clear error if missing


- `settingSources: ["project"]` to load project features (skills/memory).
- `allowedTools`: include `"Skill"`, plus your custom MCP tools and any built-ins you intend.

### 11.4 Tooling Strategy (MCP Tools)
Implement as in-process MCP server used by the agent runner:

#### Gmail tools
- `gmail.search({ query, maxResults })`
- `gmail.getMessage({ messageId, format })`
- `gmail.getAttachment({ messageId, attachmentId })`
- `gmail.createDraft({ to, subject, bodyText, cc?, attachments? })`
- `gmail.sendDraft({ draftId, approvalToken })` **(guarded)**

#### UI tool
- `emit_ui({ kind, payload })` → writes `RunEvent(type="ui")`

#### Orchestration tools
- `spawn_bron({ title, prompt, parentRunId })` → creates child run and triggers child workflow
- `await_bron({ runId })` → waits until child run finishes (poll DB)

### 11.5 Approval Gate Enforcement
**Hard requirement:** even if the agent “asks to send,” the tool must refuse unless:
- the run has an approval token set
- the provided approval token matches stored hash (one-time)
- optional: UI-confirmed recipient allowlist for demo

Implementation options:
- Tool implementation checks DB state at call time.
- Middleware/hook in your runner denies `gmail.sendDraft` by default.

### 11.6 Workflow + Sandbox Execution Plan (Concrete)

This section spells out how the background run is executed on Vercel end-to-end.

**Trigger**
- `POST /api/runs` creates the Run (status = `queued`) and triggers a Workflow execution with `runId`.

**Workflow steps (recommended structure)**
1) **Load context**
   - Fetch Bron config (`system_prompt`, `memory_summary`) and transcript tail from DB.
   - Fetch Run prompt and associated uploads.
   - Load Gmail OAuth tokens; refresh access token if needed.

2) **Create sandbox**
   - Call `Sandbox.create({ runtime: "nodeXX", timeout / resource config })`.
   - Persist `sandboxId` in Workflow state (so you can reference it in later steps if needed).

3) **Stage inputs in sandbox**
   - Download any uploaded files or Gmail attachments (if you choose to stage pre-run) into the sandbox working directory.
   - Write a small “agent runner” entrypoint file into the sandbox (or use a baked-in runner in your repo image).
   - Ensure `.claude/skills/**` exists (copied from your repo) so Skills are available via `settingSources: ["project"]`.

4) **Run the agent**
   - Execute your runner via `sandbox.runCommand("node", ["runner.js", "--runId", "<id>"], { env: { ANTHROPIC_API_KEY, ... } })`.
   - The runner writes `RunEvent`s to DB as it progresses:
     - `status` events (`running`, `needs_approval`, etc.)
     - `log` events (human-readable progress)
     - `ui` events (cards)
     - `artifact` events (Blob URLs / JSON)

5) **Handle approval gate**
   - The agent runner must treat `gmail.sendDraft` as blocked by default.
   - When the agent reaches a “ready to send” point:
     - Write `status = needs_approval`
     - Emit an `EmailDraftCard` UI event
     - Stop execution (exit runner gracefully) OR transition the Workflow into an “await approval” state.

   **Implementation option A (simplest for MVP): two-phase run**
   - Phase 1 ends at “needs_approval” and stops the sandbox.
   - User clicks “Approve & Send” → `POST /api/runs/:id/approve-send` creates a second Workflow execution to perform the send (and final confirmation).
   - Because this MVP does not need a persistent filesystem, re-creating a sandbox for Phase 2 is fine.

   **Implementation option B (single workflow with wait):**
   - Use Workflow primitives to wait for an external signal/approval.
   - Store `sandboxId` if you plan to reuse it; otherwise stop sandbox and resume later in a new one.

6) **Cleanup**
   - Always call `sandbox.stop()` in a `finally`-style cleanup step.
   - Update Run status to `succeeded` or `failed` and write final `RunSummaryCard`.

**Child runs (“spawn other Brons”)**
- `spawn_bron(...)` creates a child Run row and triggers its Workflow.
- Parent run emits `child_run` events and can poll/await child completion via DB reads.


### 11.7 Memory summarization and transcript truncation (Specified)

This MVP persists **memory summary + full transcript**, but each run must fit within a bounded prompt context.

**What is persisted**
- **Full transcript:** stored in `bron_messages` (or derived from `run_events(type="message")`).
- **Memory summary:** `brons.memory_summary` is a rolling summary of durable, user-specific context.
- **Optional “conversation summary”:** a short rolling summary of older transcript segments (separate from memory). This is useful if transcript grows large.

**When memory is updated**
- **At the end of every run** (success or failure), run a “memory update” step that:
  1) reads prior `memory_summary`
  2) reads transcript delta for this run
  3) produces an updated `memory_summary`
- **Optionally mid-run**: if the run crosses a threshold (e.g., >50 messages or >N tool calls), write a “checkpoint summary” event to reduce risk of losing context on failure.

**Timing policy (MVP)**
- **Yes: update after every run** (success or failure) so user-provided preferences are not lost.
- **Success runs:** may write both (a) durable user preferences and (b) confirmed stable facts (e.g., “send drafts to Alex by default”).
- **Failed/aborted runs:** only write durable **user messages/preferences/policies**; **do not** persist unverified extracted data from attachments/emails.
- Memory updates are **best-effort**: if summarization fails, keep prior memory unchanged and log an error event.

**How memory is updated (algorithm)**
- Use a dedicated summarization prompt and strict output rules:
  - Keep stable preferences (writing style, communication tone)
  - Keep important entities (contacts, recurring send-to addresses, vendor names)
  - Keep constraints/policies (approval gates, safety rules)
  - Exclude sensitive raw content unless necessary (avoid copying entire emails/attachments)
- Store only the *result* summary; do not store chain-of-thought.

**Transcript tail construction for each run**
- Build the prompt context in this order:
  1) System prompt (Bron persona + safety rules)
  2) Memory summary (rolling, ~0.5–2 KB target)
  3) Most recent transcript tail
  4) Current user task prompt
- **Token budget strategy (recommended)**
  - Reserve space for tool traces and model output.
  - Include at most **last 20–40 messages** OR up to a token budget (e.g., 6–10k tokens depending on model).
  - If transcript exceeds budget, include:
    - a short “conversation summary” for older parts, plus
    - the last N messages in full.

**Failure behavior**
- If summarization step fails, keep prior `memory_summary` unchanged and log an error event.
- Never block run completion solely on memory update; treat memory update as “best-effort.”


### 11.8 Child run failure handling (Specified)

Child runs (spawned Brons) are treated as **subtasks**. The parent run must decide whether a child failure is fatal.

**Default policy (Demo MVP): Best-effort**
- If a child run fails:
  - Parent emits a `child_run` event noting failure + error summary.
  - Parent continues with partial results when possible.
  - Parent may optionally spawn a fallback child run (once) with a simpler prompt (“Try again with fewer steps”).

**Alternative policy (opt-in per spawn): Fail-fast**
- Parent marks itself `failed` if any required child fails.
- Use this when the subtask is mandatory (e.g., extraction required to draft email).

**Implementation details**
- `spawn_bron(...)` accepts `failureMode: "best_effort" | "fail_fast"` (default `best_effort`).
- Parent uses `await_bron(...)` which returns `{ status, summary, result }`.
- Parent aggregates results:
  - missing child results become “unknown” fields in UI tables rather than crashing the run.
- Parent always surfaces a human-readable “What failed and what I did about it” message in the timeline.

**Retries**
- For transient errors (network, Gmail 429/5xx), child may retry internally with backoff.
- For logic errors, parent may do at most one fallback spawn to avoid runaway loops.


### 11.9 Sandbox timeout and long extraction handling (Specified)

Runs may involve PDF parsing or large attachments that exceed a “happy path” (e.g., 30 seconds). The system must handle this gracefully.

**Sandbox runtime defaults and configuration**
- Sandboxes have a **default timeout** and a configurable timeout when created.
- For longer workloads, the sandbox timeout can be extended dynamically via `extendTimeout` (plan/limits apply).
- For demo, use:
  - initial sandbox timeout: 10–15 minutes
  - step-level budgets: extraction soft-limit 30s, hard-limit 2–3 minutes

**Command-level timeout**
- Wrap long-running extraction commands with an AbortSignal timeout in the orchestrator.
- If extraction exceeds the hard-limit:
  - cancel extraction command
  - emit a UI card indicating partial extraction
  - optionally spawn a child run that tries a cheaper extraction method (e.g., “extract only first page”)

**Soft-limit behavior (>30s)**
- If extraction passes the soft-limit, emit a `log` event (“Still extracting…”) so the UI stays alive.
- If overall run is still healthy, extend sandbox timeout as needed (up to configured max).

**Hard failure behavior**
- If sandbox hits its timeout or crashes:
  - Mark run `failed`
  - Persist partial results already extracted
  - Emit a `RunSummaryCard` explaining what was completed and what was not

**Workflow step duration**
- Keep individual Workflow steps short and resilient:
  - prefer staging + “run agent” as a bounded operation
  - use multi-step workflows or two-phase approval to avoid a single step running indefinitely


### 11.10 Error recovery, retries, and resume semantics (Specified)

Runs may fail due to network errors, parsing failures, sandbox timeouts, or model/tool errors. The system must preserve partial progress and provide a predictable retry story.

**What happens on mid-run failure**
- Mark the run `failed` and store a short error summary in `runs.error`.
- Preserve any artifacts already produced (downloaded attachment, extracted JSON, draftId).
- Emit a `RunSummaryCard` that includes:
  - what completed
  - what failed
  - recommended next action (“Retry”, “Reconnect Gmail”, “Try a narrower query”)

**Retry vs resume**
- **MVP behavior: Retry (new run)**
  - The UI shows a “Retry run” button.
  - Clicking “Retry” creates a new run with the same `bronId`, `prompt`, and references to the same uploads.
  - This avoids trying to “continue” a partially-executed agent state (runs are independent by design).

- **Best-effort resume optimization (optional)**
  - The new run can **skip work** if artifacts exist from the previous run:
    - If attachment bytes were already stored as a Blob artifact, reuse them.
    - If `draftId` already exists, reuse draft and only re-render UI.
  - This is implemented by checking DB/Blob at the beginning of a retry and emitting events that indicate “Reused prior artifact …”.

**Idempotency rules**
- Gmail search/read/attachment download may be repeated safely.
- Draft creation should be treated as idempotent per run:
  - once created, store `draftId` in DB and reuse on retry of the *same* run.
- Sending must be attempted at most once per approval token:
  - `gmail.sendDraft` checks approval token validity and consumes it on success.

**Operational retries**
- Transient errors (429/5xx) are retried with backoff (see §13.5).
- Non-transient errors (invalid_grant, parsing exceptions) fail fast with actionable UI.


---

## 12. Generative UI Spec

### 12.1 Event types
All events have `{ runId, seq, createdAt, type, payload }`.

- `status`: `{ status }`
- `log`: `{ message, level?: "info"|"warn"|"error" }`
- `message`: `{ role: "user"|"assistant", content }`
- `tool`: `{ name, phase: "start"|"end", input?, output?, error? }`
- `ui`: `{ kind, payload }`
- `artifact`: `{ kind, blobUrl?, data? }`
- `child_run`: `{ childRunId, title, status }`

### 12.2 UI card kinds & payloads

#### `EmailSearchResultsCard`
```json
{
  "query": "subject:\"Invoice\" has:attachment newer_than:30d",
  "matches": [
    { "messageId": "...", "from": "...", "subject": "...", "date": "...", "reason": "has attachment + subject match" }
  ]
}
```

#### `AttachmentSummaryCard`
```json
{
  "messageId": "...",
  "attachments": [
    { "filename": "invoice.pdf", "mimeType": "application/pdf", "sizeBytes": 123456, "attachmentId": "..." }
  ]
}
```

#### `ExtractedFieldsTable`
```json
{
  "source": "invoice.pdf",
  "fields": [
    { "key": "Invoice Number", "value": "INV-1234", "confidence": 0.92 },
    { "key": "Amount", "value": "$1,234.56", "confidence": 0.88 }
  ]
}
```

#### `EmailDraftCard`
```json
{
  "to": "name@example.com",
  "cc": [],
  "subject": "Invoice INV-1234 details",
  "bodyText": "Hi ...",
  "draftId": "xyz",
  "requiresApproval": true
}
```

#### `RunSummaryCard`
```json
{
  "outcome": "succeeded",
  "highlights": ["Found email", "Downloaded invoice.pdf", "Extracted 8 fields", "Drafted email"],
  "sentMessageId": "optional"
}
```

### 12.3 Frontend rendering
- Brons list view displays:
  - current status
  - latest `ui` card title/preview
- Run view displays:
  - full event timeline
  - collapsible tool call details (optional)
  - draft card with “Approve & Send”

---

## 13. Gmail Integration Details

### 13.1 OAuth
- Google OAuth consent screen configured in “Testing” for demo.
- Store refresh token encrypted.
- On each run, refresh access token if expired.

### 13.2 Scopes (demo)
- Read/search: `gmail.readonly`
- Send: `gmail.send`

### 13.3 Attachment parsing
- Attachments returned as base64url content; decode to bytes.
- For PDFs:
  - attempt text extraction (PDF parsing library)
  - optional: convert to text using system tools in sandbox (when feasible)
- For CSV/XLSX:
  - parse via Node libs

### 13.4 Sending guard
- Send uses Gmail API `drafts.send` or `messages.send` with RFC 2822 raw message base64url.
- Only allowed after approval token is present and valid.

### 13.5 OAuth token refresh + retry logic (Specified)

Gmail tools must be resilient to expired access tokens and transient Google API failures.

**Access token refresh**
- Before first Gmail call in a run:
  - If `expiry` is within a safety window (e.g., < 2 minutes), refresh immediately.
- If a Gmail API call returns `401` (Unauthorized):
  - Attempt exactly **one** refresh + retry the call once.
  - If retry fails with `401` or refresh fails (`invalid_grant`, revoked token), transition the run to a **needs_auth** experience:
    - Emit `status` → `failed` OR introduce `needs_auth` status if you add it
    - Emit a UI card prompting user to reconnect Gmail
    - Stop further Gmail actions

**Transient error retries**
- For `429` (rate limit) and `5xx` responses:
  - Retry with exponential backoff + jitter (e.g., 0.5s, 1s, 2s, 4s; cap at 10–15s).
  - Maximum 3–5 attempts depending on the endpoint.
- For attachment download failures, prefer retrying download before re-running the entire search.

**Idempotency**
- Draft creation is idempotent per run by storing `draftId` in DB once created.
- Sending is protected by the approval token and should be attempted at most once; if the send call errors after request submission, surface “unknown send state” and prompt user to check Gmail Sent mail.


---

## 14. Security & Privacy

### 14.1 Secrets
- Store:
  - `ANTHROPIC_API_KEY` in Vercel environment variables.
  - Google OAuth client secret in Vercel env.
  - Token encryption key in Vercel env.

### 14.2 Isolation
- Run agent execution inside Vercel Sandbox, not in request handlers.
- Treat all attachments as untrusted input.
- Avoid executing unknown code from attachments.

### 14.3 Consent and safety
- Show a clear “This Bron will access your Gmail” consent UI.
- Always require explicit click-to-send.
- Log audit events for “send attempted” and “send approved.”

---

## 15. Observability

### 15.1 Logging
- Persist run events as the source of truth.
- Also log structured traces (workflow step start/end, sandbox create, tool calls).

### 15.2 Metrics (MVP)
- Run duration, success rate
- Number of tool calls per run
- Email send approvals vs cancellations
- Cost estimates (token usage) if available

---

## 16. Performance Targets (Demo)

- Run creation API returns in < 300ms (enqueue only).
- SSE event latency: < 1s from worker write to client display (best effort).
- Gmail search step: < 5s typical.
- Attachment extraction: < 30s typical for small PDFs.
- End-to-end demo run: < 2–3 minutes typical.

---

## 17. MVP Acceptance Criteria

### Brons list view
- [ ] Displays Brons with distinct colored avatars
- [ ] Shows status + latest run title
- [ ] Updates in near real-time based on run events

### Run view
- [ ] Can start a run from chat prompt
- [ ] Can view timeline of events while run executes
- [ ] Shows at least 3 UI card types (search results, extracted fields, email draft)

### Gmail demo
- [ ] Bron can search for email using a query
- [ ] Bron can download an attachment and extract >= 5 meaningful fields
- [ ] Bron creates a Gmail draft
- [ ] Sending is blocked until user clicks Approve
- [ ] After approval, message is sent and confirmation displayed

### Multi-agent
- [ ] Manager Bron can spawn at least 1 child run and incorporate results

---

## 18. Phased Roadmap

### Phase 0 (Demo MVP)
- Single user, Gmail demo, UI cards, approval gate, sandboxed execution.

### Phase 1 (Polish)
- Better memory summarization across runs
- Run cancellation
- Richer UI components + export artifacts
- Improved attachment parsing

### Phase 2 (Product direction)
- Multi-user auth + per-user API keys
- Scheduled watch tasks
- Marketplace of Skills
- Tool permission UI and audit console

---

## 19. Open Questions / Decisions (Resolved for MVP)

This section captures key architectural decisions that significantly affect implementation. For the Demo MVP, these are **resolved** as follows:

### 19.1 Streaming transport: SSE (chosen) vs WebSocket
- **Decision:** SSE for run streaming (`/api/runs/:id/stream`).
- **Rationale:** Works with streaming HTTP responses; simpler; fits server→client-only updates. WebSockets are not used for Vercel-only long-lived connections due to function execution limits.
- **Fallback:** polling endpoint (`/api/runs/:id/events`) when SSE is unavailable.

### 19.2 Database: Neon vs Supabase
- **Decision (Demo MVP): Neon Postgres** with a serverless-friendly connection strategy.
- **Recommended driver approach on Vercel:**
  - Prefer a serverless/HTTP-style driver for request handlers to avoid exhausting Postgres connection limits, or
  - If using `pg` pools, follow Vercel guidance (global pool + attach/cleanup) and avoid “double pooling” if your DB provider already uses PgBouncer.
- **Supabase alternative:** use Supabase pooler connection strings (transaction mode for serverless) and be mindful of pooling mode selection.

### 19.3 Cost controls (concrete defaults)
Costs can spike with runaway tool loops. The runner must enforce guardrails with explicit caps.

**Default caps (Demo MVP)**
- Max wall-clock per run: **8 minutes**
- Max sandbox timeout: **15 minutes** (only if needed; extend if supported by plan)
- Max model turns (LLM calls): **20**
- Max total tool calls: **40**
  - Max Gmail calls: **25**
  - Max WebFetch/WebSearch calls: **10**
- Max child runs spawned by a parent: **3**
- Max attachment size processed: **20 MB** (larger files -> fail with actionable UI)
- Max transcript tail: **last 30 messages** (plus memory summary), bounded by token budget

**Behavior when exceeding caps**
- Abort gracefully:
  - Emit a `RunSummaryCard` explaining the cap that was hit and how to proceed (“narrow query”, “reduce attachment size”, “split into smaller tasks”).
- Never auto-increase caps without operator intent; caps should be configured via env for the demo.

### 19.4 Remaining open items (allowed to defer)
- PDF extraction library selection and its reliability across scanned docs.
- Whether to add a third transport option (WebSocket) in a non-Vercel-only Phase 2.


---

## Appendix A: Suggested Demo Script (Step-by-step)

1) Connect Gmail (OAuth)  
2) In chat: “Find the email from X with subject Y containing the latest invoice, extract invoice number and total, then draft an email to Z with the details.”  
3) Watch streamed progress:
   - Search Results Card
   - Attachment Summary
   - Extracted Fields Table
   - Email Draft Card (Approve button)  
4) Click Approve & Send  
5) See Sent Confirmation + Run Summary

---


## 20. Testing Strategy

The demo includes Gmail integration and background execution; tests must be reliable without requiring real credentials in CI.

### 20.1 Unit tests
- **MCP tool unit tests**:
  - Implement a `FakeGmailProvider` that returns deterministic fixtures for:
    - search results
    - message payload structures (including multipart + attachments)
    - attachment bytes
    - draft creation and send outcomes
  - Validate:
    - correct parsing of `payload.parts` to locate attachments
    - correct base64url decode/encode behavior
    - approval token enforcement for sending
- **Agent runner unit tests**:
  - Run the runner with the fake tools and assert it emits the expected `RunEvent` sequence for a known prompt.

### 20.2 Integration tests (no real Gmail)
- Use HTTP mocking (e.g., `nock`) to simulate Gmail API responses for:
  - `messages.list`
  - `messages.get`
  - `attachments.get`
  - `drafts.create`
  - `drafts.send`
- Ensure token refresh paths are exercised:
  - simulate `401` then success after refresh

### 20.3 Manual end-to-end test (real Gmail, demo account)
- Use a dedicated Gmail account and a dedicated recipient allowlist.
- Keep OAuth consent screen in “Testing” mode for the demo.
- Pre-seed test emails with known attachments to make the demo reproducible.
- For safety, set a hard allowlist for `to` addresses during the demo.

### 20.4 Sandbox execution tests
- Verify sandbox creation + command execution works independently of the agent logic.
- Add a smoke test workflow that:
  - creates sandbox
  - writes a file
  - reads it back
  - stops sandbox


## References (Implementation docs)

```
Vercel Sandbox docs: https://vercel.com/docs/vercel-sandbox
Sandbox class reference (runCommand): https://vercel.com/docs/vercel-sandbox/reference/classes/sandbox
extendTimeout changelog: https://vercel.com/changelog/dynamically-extend-timeout-of-an-active-sandbox
Sandbox pricing/limits: https://vercel.com/docs/vercel-sandbox/pricing
Vercel Functions max duration: https://vercel.com/docs/functions/configuring-functions/duration
Upstash rate limiting for Next.js: https://upstash.com/blog/nextjs-ratelimiting
Vercel template (Upstash ratelimit): https://vercel.com/templates/next.js/ratelimit-with-upstash-redis
```

