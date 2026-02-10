use serde::{Deserialize, Serialize};

/// Supported TTS engine types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EngineType {
    System,
    Piper,
    Cloud,
}

/// Cloud TTS provider
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CloudProvider {
    OpenAI,
    Azure,
    Google,
}

/// Voice information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: Option<String>,
}

/// TTS synthesis request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsRequest {
    pub text: String,
    pub engine: Option<EngineType>,
    pub voice: Option<String>,
    pub rate: Option<f32>,   // 0.5 - 2.0, default 1.0
    pub pitch: Option<f32>,  // 0.5 - 2.0, default 1.0
    pub volume: Option<f32>, // 0.0 - 1.0, default 1.0
}

/// TTS synthesis result — raw audio bytes
#[derive(Debug)]
#[allow(dead_code)]
pub struct TtsResult {
    pub audio_data: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    /// "wav", "mp3", "pcm", etc.
    pub format: String,
}

/// TTS engine configuration (persisted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsConfig {
    pub active_engine: EngineType,
    pub system: SystemTtsConfig,
    pub piper: PiperTtsConfig,
    pub cloud: CloudTtsConfig,
    pub default_rate: f32,
    pub default_pitch: f32,
    pub default_volume: f32,
}

impl Default for TtsConfig {
    fn default() -> Self {
        Self {
            active_engine: EngineType::System,
            system: SystemTtsConfig::default(),
            piper: PiperTtsConfig::default(),
            cloud: CloudTtsConfig::default(),
            default_rate: 1.0,
            default_pitch: 1.0,
            default_volume: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemTtsConfig {
    pub voice: Option<String>,
}

impl Default for SystemTtsConfig {
    fn default() -> Self {
        Self { voice: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiperTtsConfig {
    pub model_path: Option<String>,
    pub piper_binary: Option<String>,
}

impl Default for PiperTtsConfig {
    fn default() -> Self {
        Self {
            model_path: None,
            piper_binary: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudTtsConfig {
    pub provider: CloudProvider,
    pub api_key: Option<String>,
    pub voice: Option<String>,
    pub endpoint: Option<String>,
}

impl Default for CloudTtsConfig {
    fn default() -> Self {
        Self {
            provider: CloudProvider::OpenAI,
            api_key: None,
            voice: None,
            endpoint: None,
        }
    }
}

/// Current TTS playback state (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlaybackState {
    Idle,
    Synthesizing,
    Playing,
    Paused,
    Error,
}
