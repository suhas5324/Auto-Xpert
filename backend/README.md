# Car Damage Backend

This backend is prepared for local testing and Render deployment with the current frontend API contract:

- `POST /predict`
- `GET /api/nearest-centres`
- `GET /api/route`
- `GET /api/centre-details`
- `GET /health`

## Local run

```powershell
cd backend
myenv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

The frontend already expects the backend base URL through `VITE_API_BASE_URL` and falls back to `http://localhost:8000` in development.

## Render deployment

If you push the `backend` folder as its own repository, Render can use the included `render.yaml`.
If you later deploy from a monorepo instead, point Render's root directory to `backend`.

Manual settings:

- Runtime: `Python`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`
- Python version: `3.10.0`

Important:

- `convnextb_finetuned.pth` is currently about `350 MB`, which is larger than GitHub's normal file-size limit for a standard Git push.
- If you do not store that file with Git LFS, set `SEVERITY_MODEL_URL` on Render so the backend can download it at startup.
- The backend still supports local model files first, so your current local workflow continues to work.

## Environment variables

Copy `.env.example` to `.env` if you want local overrides.

Most useful variables:

- `CORS_ALLOW_ORIGINS`: comma-separated list such as `http://localhost:5173,https://your-frontend.onrender.com`
- `SEVERITY_MODEL_PATH`
- `TYPE_MODEL_PATH`
- `YOLO_MODEL_PATH`
- `SEVERITY_MODEL_URL`
- `TYPE_MODEL_URL`
- `YOLO_MODEL_URL`

## Frontend alignment

This backend keeps the same routes used in `car_damage_frontend/src/config.js`, `car_damage_frontend/src/DamageViewer.jsx`, and `car_damage_frontend/src/NearestServiceCenter.jsx`.

It also uses the same Overpass fallback strategy the frontend had, so nearby service-centre lookup is less brittle during deployment.
