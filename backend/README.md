# CollabCode Backend (Sprint 1)

This service provides the first backend slice for secure code execution:

- Create execution jobs
- Build runtime images on the fly from trusted templates
- Run code in constrained Docker containers
- Stream stdout/stderr to clients in real time over WebSocket
- Stop running jobs
- Pre-execution live scan (basic rule-based scanner)
- Runtime diagnostics for Docker availability

## Implemented in this slice

- `POST /v1/executions`: create an execution
- `GET /v1/executions/:executionId`: execution status + diagnostics
- `POST /v1/executions/:executionId/stop`: force stop
- `WS /v1/executions/:executionId/stream`: realtime event stream
- `GET /health`: includes backend runtime diagnostics

Execution status progression:

- `queued`
- `scanning`
- `building`
- `running`
- final: `completed`, `failed`, `blocked`, or `stopped`

## Run

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm run dev
```

or

```bash
npm run start
```

## API

- `GET /health`
- `POST /v1/executions`
- `GET /v1/executions/:executionId`
- `POST /v1/executions/:executionId/stop`
- `WS /v1/executions/:executionId/stream`

## Quick test

Create an execution (PowerShell):

```powershell
$body = @{ language = 'javascript'; code = 'console.log("hello")' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/v1/executions' -Method Post -ContentType 'application/json' -Body $body
```

Check execution status:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/v1/executions/<execution-id>' -Method Get | ConvertTo-Json -Depth 10
```

Health diagnostics:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -Method Get | ConvertTo-Json -Depth 10
```

## Docker requirement

Docker must be installed and available in PATH (`docker version`).

If Docker is unavailable, executions will fail gracefully with:

- `status: failed`
- `failureReason: Docker is not available...`

This behavior is expected and helps frontend integration before deployment hosts are ready.

## Frontend integration notes (next step)

- Call `POST /v1/executions` when user presses Run.
- Open `WS /v1/executions/:id/stream` immediately after receiving `executionId`.
- Append events by `seq` order.
- Use `stdout` and `stderr` events for terminal output.
- Display `scan-report` and `system` events in a build/security panel.
- Poll `GET /v1/executions/:id` as fallback if socket disconnects.
