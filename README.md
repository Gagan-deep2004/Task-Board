# Task Board

A Trello-style Kanban board: JWT auth, role-based board/task permissions, drag-and-drop lists and tasks, per-task sharing, real-time sync over Socket.io (with a Redis adapter for multi-instance scaling), and Cloudinary-backed file attachments.

**Stack:** React + Vite (client) · Express + Mongoose + Socket.io (server) · MongoDB · Redis (optional) · Cloudinary

## Features

**Auth & access control**
- JWT authentication with bcrypt-hashed passwords
- Board-level roles (Owner / Admin / Viewer) plus a visibility tier per board (Private / Shared / Public)
- Per-task sharing: invite a specific registered user to one task as a Viewer (read-only) or Editor (can edit just that task, enforced server-side even for users with no board-wide access)

**Data integrity**
- Optimistic concurrency control on tasks - the client's version is checked against the stored version before every edit, returning a 409 Conflict instead of silently overwriting someone else's concurrent change
- Board-scope validation on every list/task write (prevents editing a task/list by ID unless it actually belongs to the board being acted on)

**Real-time collaboration**
- Socket.io WebSocket sync - task, list, and board changes broadcast instantly to everyone viewing that board
- Redis adapter for horizontal scaling across multiple server instances, with automatic fallback to single-instance mode when Redis isn't configured
- Live presence ("who's viewing this board") via a heartbeat/timeout mechanism that drops stale connections

**Kanban UI**
- Drag-and-drop task cards between lists and reordering of lists (`@dnd-kit`)
- Board dashboard, list/task CRUD, and a task detail modal, all backed by React Query for caching and optimistic UI updates

**File attachments**
- Multer + Cloudinary - uploaded files are streamed straight to cloud storage (never written to local disk), with type/size validation

**Onboarding**
- New accounts are auto-seeded with a starter board and sample tasks instead of an empty dashboard

## Project structure

```
client/   React app (Vite)
server/   Express API + Socket.io
```

## Local development

**Prerequisites:** Node 20+, a MongoDB instance (local or Atlas).

```bash
# Backend
cd server
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
npm start              # http://localhost:5000

# Frontend (separate terminal)
cd client
npm install
npm run dev             # http://localhost:5173
```

### Server environment variables (`server/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | defaults to 5000 |
| `MONGO_URI` | yes | local (`mongodb://127.0.0.1:27017/task_board`) or MongoDB Atlas |
| `JWT_SECRET` | yes | any long random string |
| `REDIS_URL` | no | enables the Socket.io Redis adapter for multi-instance scaling; leave blank for single-instance mode |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | no | required only for task file attachments |

### Client environment variables (`client/.env`, see `.env.example`)

| Variable | Notes |
|---|---|
| `VITE_API_URL` | backend REST base URL, e.g. `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | backend origin for Socket.io, e.g. `http://localhost:5000` |
