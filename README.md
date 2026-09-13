# Task Board

A Trello-style Kanban board: JWT auth, role-based board/task permissions, drag-and-drop lists and tasks, per-task sharing, real-time sync over Socket.io (with a Redis adapter for multi-instance scaling), and Cloudinary-backed file attachments.

**Stack:** React + Vite (client) · Express + Mongoose + Socket.io (server) · MongoDB · Redis (optional) · Cloudinary

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

## Deploying

The frontend (static) and backend (Node process) deploy separately.

### 1. Database - MongoDB Atlas (free tier)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas/register) and create a free **M0** cluster.
2. Under **Database Access**, add a database user with a username/password.
3. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`) - simplest option for a small deployed app on a host without a static IP.
4. Under **Connect → Drivers**, copy the `mongodb+srv://...` connection string, substitute your user's password, and append a database name, e.g. `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/task_board`.

### 2. Backend - Render

1. Push this repo to GitHub (see below).
2. On [render.com](https://render.com), create a **Web Service** from your GitHub repo.
3. Set **Root Directory** to `server`, **Build Command** to `npm install`, **Start Command** to `npm start`.
4. Add environment variables in Render's dashboard: `MONGO_URI` (from Atlas), `JWT_SECRET`, and optionally `REDIS_URL`/`CLOUDINARY_*`.
5. Deploy. Render gives you a URL like `https://task-board-xxxx.onrender.com` - that's your backend origin.

### 3. Frontend - GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) builds and deploys `client/` automatically on every push to `main`.

1. In your GitHub repo, go to **Settings → Pages** and set **Source** to "GitHub Actions".
2. Go to **Settings → Secrets and variables → Actions** and add two repo secrets, pointing at your Render backend from step 2:
   - `VITE_API_URL` = `https://task-board-xxxx.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://task-board-xxxx.onrender.com`
3. Push to `main` - the workflow builds the client and publishes it to `https://<your-username>.github.io/<repo-name>/`.

Note: the app uses `HashRouter` (URLs like `.../#/dashboard`) specifically so client-side routes keep working on GitHub Pages, which has no server-side rewrite support.

### Pushing to GitHub for the first time

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-empty-repo-url>
git push -u origin main
```

`.env` files are gitignored - double check `git status` before your first commit that no `.env` file is staged.
