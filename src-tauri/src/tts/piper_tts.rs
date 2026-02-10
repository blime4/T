use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use super::engine::TtsEngine;
use super::types::{TtsRequest, TtsResult, VoiceInfo};

/// Piper offline TTS engine.
/// Requires the `piper` binary and a voice model (.onnx + .json) to be present.
pub struct PiperTtsEngine {
    piper_binary: PathBuf,
    model_path: Option<PathBuf>,
}

impl PiperTtsEngine {
    pub fn new(piper_binary: Option<String>, model_path: Option<String>) -> Self {
        let piper_binary = piper_binary
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("piper"));
        let model_path = model_path.map(PathBuf::from);
        Self {
            piper_binary,
            model_path,
        }
    }

    #[allow(dead_code)]
    pub fn set_model(&mut self, path: &str) {
        self.model_path = Some(PathBuf::from(path));
    }

    #[allow(dead_code)]
    pub fn set_binary(&mut self, path: &str) {
        self.piper_binary = PathBuf::from(path);
    }
}

#[async_trait]
impl TtsEngine for PiperTtsEngine {
    fn name(&self) -> &str {
        "Piper TTS"
    }

    async fn is_available(&self) -> bool {
        // Check if piper binary exists and is executable
        let status = Command::new(&self.piper_binary)
            .arg("--help")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;
        status.map(|s| s.success()).unwrap_or(false)
    }

    async fn list_voices(&self) -> Result<Vec<VoiceInfo>> {
        // Piper doesn't have a built-in voice listing command.
        // We return the currently configured model as the only voice.
        let mut voices = Vec::new();
        if let Some(ref model) = self.model_path {
            let name = model
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "piper-model".to_string());
            voices.push(VoiceInfo {
                id: model.to_string_lossy().to_string(),
                name,
                language: None,
            });
        }
        Ok(voices)
    }

    async fn synthesize(&self, request: &TtsRequest) -> Result<TtsResult> {
        let model = self
            .model_path
            .as_ref()
            .ok_or_else(|| anyhow!("No Piper model configured"))?;

        if !model.exists() {
            return Err(anyhow!("Piper model not found: {}", model.display()));
        }

        // piper reads text from stdin and writes WAV to stdout
        // Usage: echo "text" | piper --model model.onnx --output-raw
        // With --output_file - it writes WAV to stdout
        let mut child = Command::new(&self.piper_binary)
            .arg("--model")
            .arg(model)
            .arg("--output_file")
            .arg("-") // stdout
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Write text to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(request.text.as_bytes()).await?;
            // Drop stdin to close it, signaling EOF
        }

        let output = child.wait_with_output().await?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Piper TTS failed: {}", err));
        }

        // Piper outputs 16-bit PCM WAV at 22050 Hz mono by default
        Ok(TtsResult {
            audio_data: output.stdout,
            sample_rate: 22050,
            channels: 1,
            format: "wav".to_string(),
        })
    }
}
