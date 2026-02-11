# Contributing to Neko TTS

## Architecture Overview

Neko TTS is a multi-stack desktop application:

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Rust / Tauri v1 | `src-tauri/` |
| Frontend | React 18 / TypeScript / Vite | `src/` |
| Backend | Python / FastAPI | `backend/` |
| State management | Zustand | `src/store/` |
| UI components | Radix UI + Tailwind CSS v4 | `src/components/` |

## Prerequisites

- **Node.js** 20+
- **Rust** stable toolchain (for Tauri)
- **Python** 3.10+ (for backend)
- **System dependencies** (Linux only):
  ```bash
  sudo apt-get install -y \
    libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev \
    librsvg2-dev patchelf libasound2-dev
  ```

## Environment Setup

### 1. Frontend

```bash
npm ci
```

### 2. Backend (Python)

```bash
cd backend
pip install -r requirements.txt

# Apple Silicon only (optional, enables MLX acceleration):
pip install -r requirements-mlx.txt
```

### 3. Tauri (Rust)

Rust dependencies are resolved automatically by Cargo on first build.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VOICEBOX_DATA_DIR` | Override data directory for DB, profiles, audio | `./data` |
| `QWEN_TTS_PATH` | Local qwen_tts source path (for PyInstaller builds) | _(none)_ |
| `HF_HUB_CACHE` | HuggingFace model cache directory | `~/.cache/huggingface/hub/` |
| `VITE_*` | Vite-exposed env vars (frontend) | — |
| `TAURI_*` | Tauri-exposed env vars (frontend) | — |

No `.env.example` file exists. Copy the table above into a local `.env` as needed.

## Available Scripts

### npm scripts (package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `vite` | Start Vite dev server (port 1420) |
| `npm run build` | `tsc && vite build` | Type-check and build frontend to `dist/` |
| `npm run preview` | `vite preview` | Preview production build locally |
| `npm test` | `vitest run` | Run frontend tests (single run) |
| `npm run test:watch` | `vitest` | Run frontend tests in watch mode |
| `npm run tauri` | `tauri` | Tauri CLI (e.g. `npm run tauri dev`, `npm run tauri build`) |

### Backend (Python)

| Command | Description |
|---------|-------------|
| `python -m backend.main` | Start backend server (localhost:8000) |
| `python -m backend.main --host 0.0.0.0 --port 8000` | Start with remote access |
| `python -m backend.main --data-dir /path/to/data` | Custom data directory |
| `python -m backend.migrate_add_instruct` | Run database migration |

### Rust / Tauri

| Command | Description |
|---------|-------------|
| `cargo fmt` | Format Rust code |
| `cargo clippy` | Lint Rust code |
| `cargo test` | Run Rust tests |

## Development Workflow

### Running locally

1. Start the Python backend:
   ```bash
   python -m backend.main
   ```

2. In a separate terminal, start the Tauri dev app:
   ```bash
   npm run tauri dev
   ```
   This starts both the Vite dev server and the Tauri window.

### Frontend only (no Tauri)

```bash
npm run dev
```

Opens at `http://localhost:1420`.

## Testing

### Frontend (Vitest + Testing Library)

```bash
npm test              # single run
npm run test:watch    # watch mode
```

- Test setup: `src/test-setup.tsx`
- Test files: `src/__tests__/`
- Config: `vite.config.ts` (test section)

### Backend (manual test scripts)

```bash
cd backend
python tests/test_progress.py                # Unit tests for ProgressManager
python tests/test_generation_progress.py     # TTS generation + SSE progress
python tests/test_real_download.py           # Real model download test
python tests/test_check_progress_state.py    # Debug internal state
```

Backend tests require the server to be running.

### Rust

```bash
cd src-tauri
cargo test --verbose
```

## CI Pipeline

CI runs on push to `master`/`main` and on PRs (`.github/workflows/ci.yml`):

1. **rust-check** — `cargo fmt --check`, `cargo clippy`, `cargo test`
2. **frontend-check** — `tsc --noEmit`
3. **build** — Cross-platform Tauri builds (Windows, macOS arm64/x64, Linux)
4. **release** — Creates draft GitHub Release on `Neko-TTS-v*` tags

## Project Structure

```
neko-tts/
├── backend/                # Python FastAPI backend
│   ├── backends/           # MLX + PyTorch implementations
│   ├── tests/              # Manual test scripts
│   ├── utils/              # Audio, cache, progress utilities
│   ├── main.py             # FastAPI app + routes
│   ├── config.py           # Data directory configuration
│   ├── models.py           # Pydantic models
│   ├── database.py         # SQLite ORM (SQLAlchemy)
│   └── requirements.txt    # Python dependencies
├── src/                    # React/TypeScript frontend
│   ├── components/         # UI components (Radix-based)
│   ├── lib/                # API client, hooks, utils
│   ├── store/              # Zustand state
│   ├── assets/             # Lottie animations
│   └── __tests__/          # Vitest tests
├── src-tauri/              # Tauri desktop shell (Rust)
│   ├── src/                # Rust source
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri config
├── package.json            # Node.js config + scripts
├── vite.config.ts          # Vite + Vitest config
└── .github/workflows/      # CI pipeline
```
