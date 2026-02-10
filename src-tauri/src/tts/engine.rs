use anyhow::Result;
use async_trait::async_trait;

use super::types::{TtsRequest, TtsResult, VoiceInfo};

/// Trait that all TTS engines must implement
#[allow(dead_code)]
#[async_trait]
pub trait TtsEngine: Send + Sync {
    /// Human-readable name of this engine
    fn name(&self) -> &str;

    /// Check if this engine is available on the current system
    async fn is_available(&self) -> bool;

    /// List available voices for this engine
    async fn list_voices(&self) -> Result<Vec<VoiceInfo>>;

    /// Synthesize text to audio bytes
    async fn synthesize(&self, request: &TtsRequest) -> Result<TtsResult>;

    /// Stop any ongoing synthesis (best-effort)
    fn stop(&self) {}
}
