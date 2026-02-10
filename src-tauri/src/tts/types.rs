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

#[cfg(test)]
mod tests {
    use super::*;

    // ── EngineType serialization ──────────────────────────────────

    #[test]
    fn engine_type_serializes_to_snake_case() {
        assert_eq!(serde_json::to_string(&EngineType::System).unwrap(), r#""system""#);
        assert_eq!(serde_json::to_string(&EngineType::Piper).unwrap(), r#""piper""#);
        assert_eq!(serde_json::to_string(&EngineType::Cloud).unwrap(), r#""cloud""#);
    }

    #[test]
    fn engine_type_deserializes_from_snake_case() {
        assert_eq!(serde_json::from_str::<EngineType>(r#""system""#).unwrap(), EngineType::System);
        assert_eq!(serde_json::from_str::<EngineType>(r#""piper""#).unwrap(), EngineType::Piper);
        assert_eq!(serde_json::from_str::<EngineType>(r#""cloud""#).unwrap(), EngineType::Cloud);
    }

    // ── CloudProvider serialization ───────────────────────────────

    #[test]
    fn cloud_provider_serializes_to_snake_case() {
        // Note: serde snake_case splits on each capital, so OpenAI → "open_a_i"
        assert_eq!(serde_json::to_string(&CloudProvider::OpenAI).unwrap(), r#""open_a_i""#);
        assert_eq!(serde_json::to_string(&CloudProvider::Azure).unwrap(), r#""azure""#);
        assert_eq!(serde_json::to_string(&CloudProvider::Google).unwrap(), r#""google""#);
    }

    #[test]
    fn cloud_provider_round_trip() {
        for provider in [CloudProvider::OpenAI, CloudProvider::Azure, CloudProvider::Google] {
            let json = serde_json::to_string(&provider).unwrap();
            let back: CloudProvider = serde_json::from_str(&json).unwrap();
            assert_eq!(provider, back);
        }
    }

    // ── PlaybackState serialization ───────────────────────────────

    #[test]
    fn playback_state_serializes_correctly() {
        assert_eq!(serde_json::to_string(&PlaybackState::Idle).unwrap(), r#""idle""#);
        assert_eq!(serde_json::to_string(&PlaybackState::Synthesizing).unwrap(), r#""synthesizing""#);
        assert_eq!(serde_json::to_string(&PlaybackState::Playing).unwrap(), r#""playing""#);
        assert_eq!(serde_json::to_string(&PlaybackState::Paused).unwrap(), r#""paused""#);
        assert_eq!(serde_json::to_string(&PlaybackState::Error).unwrap(), r#""error""#);
    }

    // ── TtsConfig defaults ────────────────────────────────────────

    #[test]
    fn tts_config_default_values() {
        let config = TtsConfig::default();
        assert_eq!(config.active_engine, EngineType::System);
        assert_eq!(config.default_rate, 1.0);
        assert_eq!(config.default_pitch, 1.0);
        assert_eq!(config.default_volume, 1.0);
        assert!(config.system.voice.is_none());
        assert!(config.piper.model_path.is_none());
        assert!(config.piper.piper_binary.is_none());
        assert_eq!(config.cloud.provider, CloudProvider::OpenAI);
        assert!(config.cloud.api_key.is_none());
    }

    // ── TtsConfig full round-trip ─────────────────────────────────

    #[test]
    fn tts_config_serialization_round_trip() {
        let config = TtsConfig {
            active_engine: EngineType::Cloud,
            system: SystemTtsConfig { voice: Some("en-us".to_string()) },
            piper: PiperTtsConfig {
                model_path: Some("/path/to/model.onnx".to_string()),
                piper_binary: Some("/usr/bin/piper".to_string()),
            },
            cloud: CloudTtsConfig {
                provider: CloudProvider::Azure,
                api_key: Some("test-key-123".to_string()),
                voice: Some("en-US-JennyNeural".to_string()),
                endpoint: Some("https://eastus.tts.speech.microsoft.com".to_string()),
            },
            default_rate: 1.5,
            default_pitch: 0.8,
            default_volume: 0.9,
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let deserialized: TtsConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.active_engine, EngineType::Cloud);
        assert_eq!(deserialized.system.voice.as_deref(), Some("en-us"));
        assert_eq!(deserialized.piper.model_path.as_deref(), Some("/path/to/model.onnx"));
        assert_eq!(deserialized.cloud.provider, CloudProvider::Azure);
        assert_eq!(deserialized.cloud.api_key.as_deref(), Some("test-key-123"));
        assert_eq!(deserialized.default_rate, 1.5);
        assert_eq!(deserialized.default_pitch, 0.8);
        assert_eq!(deserialized.default_volume, 0.9);
    }

    // ── TtsRequest ────────────────────────────────────────────────

    #[test]
    fn tts_request_with_defaults() {
        let req = TtsRequest {
            text: "Hello world".to_string(),
            engine: None,
            voice: None,
            rate: None,
            pitch: None,
            volume: None,
        };
        assert_eq!(req.text, "Hello world");
        assert!(req.engine.is_none());
        assert!(req.rate.is_none());
    }

    #[test]
    fn tts_request_serialization() {
        let req = TtsRequest {
            text: "Test".to_string(),
            engine: Some(EngineType::Piper),
            voice: Some("en_US-lessac-medium".to_string()),
            rate: Some(1.2),
            pitch: Some(1.0),
            volume: Some(0.8),
        };
        let json = serde_json::to_string(&req).unwrap();
        let back: TtsRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(back.text, "Test");
        assert_eq!(back.engine, Some(EngineType::Piper));
        assert_eq!(back.voice.as_deref(), Some("en_US-lessac-medium"));
        assert_eq!(back.rate, Some(1.2));
    }

    // ── VoiceInfo ─────────────────────────────────────────────────

    #[test]
    fn voice_info_serialization() {
        let voice = VoiceInfo {
            id: "alloy".to_string(),
            name: "Alloy".to_string(),
            language: Some("en-US".to_string()),
        };
        let json = serde_json::to_string(&voice).unwrap();
        assert!(json.contains("alloy"));
        assert!(json.contains("Alloy"));
        assert!(json.contains("en-US"));
    }
}
