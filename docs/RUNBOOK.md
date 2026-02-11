# Neko TTS Runbook

## Deployment

### Desktop App (Tauri)

Build platform-specific installers:

```bash
npm ci
npm run tauri build
```

Outputs are in `src-tauri/target/release/bundle/`:
- Windows: `.msi`
- macOS: `.dmg`
- Linux: `.AppImage`, `.deb`

Cross-platform builds are handled by CI on tag push (`Neko-TTS-v*`).

### Backend Server (Standalone)

```bash
# Development
python -m backend.main

# Production (remote access)
python -m backend.main --host 0.0.0.0 --port 8000

# Custom data directory
python -m backend.main --data-dir /var/lib/neko-tts/data
```

CLI arguments:

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `8000` | Bind port |
| `--data-dir` | `./data` | Data directory (DB, profiles, audio, cache) |

### PyInstaller Binary

```bash
cd backend
QWEN_TTS_PATH=/path/to/qwen_tts python build_binary.py
```

Produces a standalone `voicebox-server` binary.

## Health Checks

### Backend health endpoint

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "gpu_available": true,
  "gpu_type": "CUDA" | "Metal (Apple Silicon via MLX)" | "CPU",
  "backend_type": "pytorch" | "mlx",
  "vram_used_mb": null
}
```

### Root endpoint (version info)

```bash
curl http://localhost:8000/
```

## Data Directory Layout

```
data/
├── voicebox.db              # SQLite database
├── profiles/{profile_id}/   # Voice profile audio samples
├── generations/{id}.wav     # Generated audio files
├── cache/{hash}.prompt      # Voice prompt cache
└── projects/{id}.json       # Studio projects
```

Default location: `./data` (relative to CWD). Override with `--data-dir` or `VOICEBOX_DATA_DIR`.

## Model Management

### Automatic download

Models download from HuggingFace Hub on first use. Cached in `~/.cache/huggingface/hub/`.

Available models:
- `Qwen/Qwen3-TTS-12Hz-1.7B-Base` (~4 GB, recommended for GPU)
- `Qwen/Qwen3-TTS-12Hz-0.6B-Base` (~2 GB, faster on CPU)

### Manual model operations

```bash
# Load a specific model size
curl -X POST "http://localhost:8000/models/load?model_size=1.7B"

# Unload model (free VRAM)
curl -X POST http://localhost:8000/models/unload
```

### Pre-download models (offline use)

```bash
pip install huggingface_hub
huggingface-cli download Qwen/Qwen3-TTS-12Hz-1.7B-Base
```

## Common Issues and Fixes

### Backend won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: backend` | Running from wrong directory | Run from project root: `python -m backend.main` |
| `torch` import error | Missing PyTorch | `pip install -r backend/requirements.txt` |
| Port already in use | Another process on 8000 | Use `--port 8001` or kill the existing process |

### Model issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| First generation very slow | Model downloading | Wait for download; subsequent runs use cache |
| Out of memory (OOM) | Model too large for GPU | Use `0.6B` model or unload via `/models/unload` |
| Download stalls | Network issue | Pre-download with `huggingface-cli download` |

### Frontend / Tauri issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `npm run tauri dev` fails on Linux | Missing system libs | Install GTK/WebKit deps (see CONTRIB.md) |
| Blank window | Backend not running | Start `python -m backend.main` first |
| Build fails with `distDir` error | Frontend not built | Run `npm run build` before `npm run tauri build` |

### Database issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Missing `instruct` column | Old schema | Run `python -m backend.migrate_add_instruct` |
| DB locked | Concurrent access | Ensure only one server instance is running |

## Rollback Procedures

### Application rollback

1. Releases are tagged as `Neko-TTS-v*` in git
2. Check out the previous tag:
   ```bash
   git checkout Neko-TTS-v<previous-version>
   ```
3. Rebuild:
   ```bash
   npm ci
   npm run tauri build
   ```

### Database rollback

The SQLite database is at `data/voicebox.db`. Back it up before migrations:

```bash
cp data/voicebox.db data/voicebox.db.bak
```

To restore:
```bash
cp data/voicebox.db.bak data/voicebox.db
```

### Cache invalidation

Clear voice prompt cache if generation quality degrades after model updates:

```bash
rm -rf data/cache/*.prompt
```

HuggingFace model cache:
```bash
rm -rf ~/.cache/huggingface/hub/models--Qwen--Qwen3-TTS-*
```

## Platform-Specific Notes

### Apple Silicon (M1/M2/M3)

- Install MLX deps for 4-5x faster inference: `pip install -r backend/requirements-mlx.txt`
- Backend auto-detects and uses MLX with Metal acceleration
- Transparent window requires `macOSPrivateApi: true` (already configured)

### Windows

- Uses PyTorch backend with CUDA if available, CPU fallback otherwise
- Build produces `.msi` installer

### Linux

- Requires system libraries for Tauri (GTK, WebKit, etc.)
- Build produces `.AppImage` and `.deb`
