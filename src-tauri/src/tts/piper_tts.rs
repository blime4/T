use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;

use super::engine::TtsEngine;
use super::silent_command;
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

    /// Get the configured model path (for testing)
    #[allow(dead_code)]
    pub fn model_path(&self) -> Option<&PathBuf> {
        self.model_path.as_ref()
    }

    /// Get the configured binary path (for testing)
    #[allow(dead_code)]
    pub fn binary_path(&self) -> &PathBuf {
        &self.piper_binary
    }
}

#[async_trait]
impl TtsEngine for PiperTtsEngine {
    fn name(&self) -> &str {
        "Piper TTS"
    }

    async fn is_available(&self) -> bool {
        // Check if piper binary exists and is executable
        let status = silent_command(&self.piper_binary)
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
        let mut child = silent_command(&self.piper_binary)
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── Construction ──────────────────────────────────────────────

    #[test]
    fn piper_engine_default_binary() {
        let engine = PiperTtsEngine::new(None, None);
        assert_eq!(engine.binary_path(), &PathBuf::from("piper"));
        assert!(engine.model_path().is_none());
        assert_eq!(engine.name(), "Piper TTS");
    }

    #[test]
    fn piper_engine_custom_binary_and_model() {
        let engine = PiperTtsEngine::new(
            Some("/opt/piper/piper".to_string()),
            Some("/models/en_US-lessac-medium.onnx".to_string()),
        );
        assert_eq!(engine.binary_path(), &PathBuf::from("/opt/piper/piper"));
        assert_eq!(
            engine.model_path().unwrap(),
            &PathBuf::from("/models/en_US-lessac-medium.onnx")
        );
    }

    // ── set_model / set_binary ────────────────────────────────────

    #[test]
    fn piper_engine_set_model() {
        let mut engine = PiperTtsEngine::new(None, None);
        assert!(engine.model_path().is_none());

        engine.set_model("/new/model.onnx");
        assert_eq!(
            engine.model_path().unwrap(),
            &PathBuf::from("/new/model.onnx")
        );
    }

    #[test]
    fn piper_engine_set_binary() {
        let mut engine = PiperTtsEngine::new(None, None);
        assert_eq!(engine.binary_path(), &PathBuf::from("piper"));

        engine.set_binary("/usr/local/bin/piper");
        assert_eq!(engine.binary_path(), &PathBuf::from("/usr/local/bin/piper"));
    }

    // ── list_voices ───────────────────────────────────────────────

    #[tokio::test]
    async fn piper_list_voices_no_model() {
        let engine = PiperTtsEngine::new(None, None);
        let voices = engine.list_voices().await.unwrap();
        assert!(voices.is_empty());
    }

    #[tokio::test]
    async fn piper_list_voices_with_model() {
        let engine =
            PiperTtsEngine::new(None, Some("/models/en_US-lessac-medium.onnx".to_string()));
        let voices = engine.list_voices().await.unwrap();
        assert_eq!(voices.len(), 1);
        assert_eq!(voices[0].name, "en_US-lessac-medium");
        assert_eq!(voices[0].id, "/models/en_US-lessac-medium.onnx");
        assert!(voices[0].language.is_none());
    }

    // ── synthesize error cases ────────────────────────────────────

    #[tokio::test]
    async fn piper_synthesize_no_model_configured() {
        let engine = PiperTtsEngine::new(None, None);
        let request = TtsRequest {
            text: "Hello".to_string(),
            engine: None,
            voice: None,
            rate: None,
            pitch: None,
            volume: None,
        };
        let result = engine.synthesize(&request).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No Piper model configured"));
    }

    #[tokio::test]
    async fn piper_synthesize_model_not_found() {
        let engine = PiperTtsEngine::new(None, Some("/nonexistent/path/model.onnx".to_string()));
        let request = TtsRequest {
            text: "Hello".to_string(),
            engine: None,
            voice: None,
            rate: None,
            pitch: None,
            volume: None,
        };
        let result = engine.synthesize(&request).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Piper model not found"));
    }

    // ── is_available (piper binary not installed in test env) ─────

    #[tokio::test]
    async fn piper_not_available_when_binary_missing() {
        let engine = PiperTtsEngine::new(Some("/nonexistent/piper_binary_xyz".to_string()), None);
        assert!(!engine.is_available().await);
    }
}
