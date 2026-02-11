use anyhow::{Context, Result};
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::Child;
use tokio::time::sleep;

use crate::config;
use crate::tts::silent_command;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 17493;
const HEALTH_MAX_RETRIES: u32 = 60;
const HEALTH_RETRY_INTERVAL: Duration = Duration::from_secs(1);
const SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(3);

pub struct ServerProcess {
    child: Option<Child>,
    server_url: String,
}

impl ServerProcess {
    pub fn new() -> Self {
        Self {
            child: None,
            server_url: format!("http://{}:{}", DEFAULT_HOST, DEFAULT_PORT),
        }
    }

    pub fn server_url(&self) -> &str {
        &self.server_url
    }

    /// Resolve the path to backend/server.py.
    /// 1. Check relative to the current executable's ancestor (project root)
    /// 2. Fallback to current working directory
    fn resolve_server_script() -> PathBuf {
        // In dev mode, the exe is at src-tauri/target/debug/neko-tts,
        // so project root is 3 levels up. Check for backend/server.py there.
        if let Ok(exe) = std::env::current_exe() {
            // Walk up from the executable looking for backend/server.py
            let mut dir = exe.parent().map(|p| p.to_path_buf());
            for _ in 0..5 {
                if let Some(ref d) = dir {
                    let candidate = d.join("backend").join("server.py");
                    if candidate.exists() {
                        return candidate;
                    }
                    dir = d.parent().map(|p| p.to_path_buf());
                } else {
                    break;
                }
            }
        }

        // Fallback: relative to cwd
        PathBuf::from("backend").join("server.py")
    }

    /// Resolve the python3 interpreter path.
    fn resolve_python() -> PathBuf {
        // Allow override via environment variable
        if let Ok(p) = std::env::var("NEKO_PYTHON") {
            return PathBuf::from(p);
        }
        PathBuf::from("python3")
    }

    /// Start the voicebox-server child process via python3.
    pub async fn start(&mut self) -> Result<()> {
        if self.is_running() {
            return Ok(());
        }

        let python = Self::resolve_python();
        let script = Self::resolve_server_script();
        let data_dir = config::config_dir()
            .context("Failed to resolve config dir")?
            .join("voicebox-data");

        // Ensure data directory exists
        std::fs::create_dir_all(&data_dir)
            .with_context(|| format!("Failed to create data dir: {:?}", data_dir))?;

        println!(
            "[server] Starting voicebox-server: {:?} {:?} --port {} --data-dir {:?}",
            python, script, DEFAULT_PORT, data_dir
        );

        let mut cmd = silent_command(&python);
        cmd.arg(&script)
            .arg("--host")
            .arg(DEFAULT_HOST)
            .arg("--port")
            .arg(DEFAULT_PORT.to_string())
            .arg("--data-dir")
            .arg(&data_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let child = cmd
            .spawn()
            .with_context(|| format!("Failed to spawn python3 {:?}", script))?;

        println!("[server] Process spawned (pid: {:?})", child.id());
        self.child = Some(child);
        Ok(())
    }

    /// Poll /health until the server is ready, or timeout.
    pub async fn health_check(&self) -> Result<()> {
        let url = format!("{}/health", self.server_url);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .context("Failed to build HTTP client")?;

        for attempt in 1..=HEALTH_MAX_RETRIES {
            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    println!("[server] Health check passed (attempt {})", attempt);
                    return Ok(());
                }
                Ok(resp) => {
                    println!(
                        "[server] Health check attempt {}: status {}",
                        attempt,
                        resp.status()
                    );
                }
                Err(e) => {
                    if attempt % 10 == 0 {
                        println!("[server] Health check attempt {}: {}", attempt, e);
                    }
                }
            }
            sleep(HEALTH_RETRY_INTERVAL).await;
        }

        anyhow::bail!(
            "Server did not become healthy after {} attempts",
            HEALTH_MAX_RETRIES
        )
    }

    /// Check if the child process is still alive.
    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            // try_wait returns Ok(Some(status)) if exited, Ok(None) if still running
            match child.try_wait() {
                Ok(Some(_)) => {
                    self.child = None;
                    false
                }
                Ok(None) => true,
                Err(_) => {
                    self.child = None;
                    false
                }
            }
        } else {
            false
        }
    }

    /// Gracefully stop the server: POST /shutdown, wait, then kill if needed.
    pub async fn stop(&mut self) -> Result<()> {
        // Try graceful shutdown via API
        let url = format!("{}/shutdown", self.server_url);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        let _ = client.post(&url).send().await;
        println!("[server] Sent /shutdown request");

        // Wait for graceful exit
        if let Some(ref mut child) = self.child {
            let wait_result = tokio::time::timeout(SHUTDOWN_GRACE_PERIOD, child.wait()).await;

            match wait_result {
                Ok(Ok(status)) => {
                    println!("[server] Process exited gracefully: {}", status);
                }
                _ => {
                    // Force kill
                    println!("[server] Grace period expired, killing process");
                    let _ = child.kill().await;
                }
            }
        }

        self.child = None;
        Ok(())
    }
}

impl Drop for ServerProcess {
    fn drop(&mut self) {
        // Best-effort synchronous kill on drop
        if let Some(ref mut child) = self.child {
            let _ = child.start_kill();
        }
    }
}
