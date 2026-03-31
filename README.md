# CollabCode Platform

CollabCode is a collaborative coding platform with real-time editing, secure code execution, and AI-assisted development.

It is organized as a Vite + React frontend and a Fastify backend that executes user code inside constrained Docker sandboxes.

## Table of Contents

1. Overview
2. Features
3. Tech Stack
4. Project Structure
5. Prerequisites
6. Environment Variables
7. Local Development
8. Backend API
9. Docker
10. Deployment Notes
11. Troubleshooting

## Overview

This project is built for collaborative coding sessions where users can:

- authenticate with Supabase,
- edit and organize files in-session,
- collaborate in real time,
- run code safely through a backend execution service,
- use AI chat assistance during development.

## Features

- Real-time collaboration workspace with session-based editing.
- Interactive file tree, search panel, and integrated terminal panel.
- Secure backend code execution with Docker resource constraints.
- WebSocket streaming for live execution output.
- Pre-execution security scan flow in backend execution pipeline.
- AI coding assistant integration (Gemini).
- Route protection and authentication powered by Supabase.

## Tech Stack

Frontend:

- React 18
- Vite
- Tailwind CSS
- Zustand
- Monaco Editor
- Supabase JS SDK

Backend:

- Node.js 18+
- Fastify
- Fastify WebSocket
- Zod
- Docker (runtime dependency for code execution)

## Project Structure

```text
.
|- src/                  # Frontend source (React)
|- backend/              # Backend service (Fastify + execution engine)
|- supabase/setup.sql    # Database setup SQL
|- Dockerfile            # Frontend Docker build (Nginx)
|- nginx.conf            # SPA routing config for Nginx
|- vercel.json           # SPA fallback config for Vercel
```

## Prerequisites

- Node.js 18 or newer
- npm (or pnpm)
- Docker Desktop (required for backend code execution)
- A Supabase project (for auth and session data)

## Environment Variables

Create two env files manually:

- `.env` at repository root for frontend (Vite)
- `.env` inside `backend/` for backend service

Frontend `.env` (root):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_BACKEND_URL=http://127.0.0.1:8787
```

Backend `backend/.env`:

```env
PORT=8787
HOST=0.0.0.0
ALLOWED_ORIGIN=http://localhost:5173
EXECUTION_WORKDIR=.tmp-runs
EXECUTION_TIMEOUT_MS=10000
EXECUTION_MEMORY_MB=256
EXECUTION_CPUS=0.5
MAX_CODE_SIZE_BYTES=200000
MAX_FILES=20
MAX_OUTPUT_BYTES=200000
LOG_BACKLOG_EVENTS=300
```

## Local Development

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
cd backend
npm install
cd ..
```

3. Apply database schema in Supabase:

- Run the SQL from `supabase/setup.sql` in your Supabase SQL editor.

4. Start backend (terminal 1):

```bash
cd backend
npm run dev
```

5. Start frontend (terminal 2):

```bash
npm run dev
```

6. Open the app:

- Frontend: `http://localhost:5173`
- Backend health: `http://127.0.0.1:8787/health`

## Backend API

Main endpoints:

- `GET /health`
- `POST /v1/executions`
- `GET /v1/executions/:executionId`
- `POST /v1/executions/:executionId/stop`
- `WS /v1/executions/:executionId/stream`

Execution states:

- `queued`
- `scanning`
- `building`
- `running`
- final states: `completed`, `failed`, `blocked`, `stopped`

## Docker

Frontend Docker image:

- Multi-stage build (Node build + Nginx runtime)
- Supports build args for Vite environment variables:
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_ANON_KEY`
	- `VITE_GEMINI_API_KEY`
	- `VITE_BACKEND_URL`

Example frontend image build:

```bash
docker build -t collabcode-frontend .
```

Example frontend container run:

```bash
docker run --rm -p 8080:80 collabcode-frontend
```

Backend Docker image:

```bash
cd backend
docker build -t collabcode-backend .
docker run --rm -p 10000:10000 collabcode-backend
```

## Deployment Notes

- `vercel.json` is configured for SPA route fallback.
- `nginx.conf` handles SPA client-side routing in containerized frontend deployments.
- If frontend and backend are deployed separately, set `VITE_BACKEND_URL` to the public backend URL.

## Troubleshooting

- Docker not available:
	- Backend health will report Docker diagnostics and executions will fail gracefully.
	- Ensure `docker version` works in terminal.

- CORS errors:
	- Verify backend `ALLOWED_ORIGIN` matches frontend origin.

- Supabase auth issues:
	- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct.
	- Ensure `supabase/setup.sql` was executed.

- No terminal execution output:
	- Check backend is running and frontend `VITE_BACKEND_URL` points to it.
	- Verify WebSocket access is not blocked by proxy/firewall.
