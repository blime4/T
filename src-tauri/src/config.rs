use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

use crate::tts::TtsConfig;

/// Get the config directory path for Neko TTS.
pub fn config_dir() -> Result<PathBuf> {
    let base = dirs::config_dir().context("Could not determine config directory")?;
    Ok(base.join("neko-tts"))
}

/// Get the full path to the config file.
pub fn config_file_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("config.json"))
}

/// Load config from disk, or return default if not found.
pub fn load_config() -> TtsConfig {
    match try_load_config() {
        Ok(config) => config,
        Err(e) => {
            eprintln!("Could not load config (using defaults): {}", e);
            TtsConfig::default()
        }
    }
}

fn try_load_config() -> Result<TtsConfig> {
    let path = config_file_path()?;
    if !path.exists() {
        return Ok(TtsConfig::default());
    }
    let content = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read config file: {:?}", path))?;
    let config: TtsConfig = serde_json::from_str(&content)
        .with_context(|| "Failed to parse config JSON")?;
    Ok(config)
}

/// Save config to disk.
pub fn save_config(config: &TtsConfig) -> Result<()> {
    let path = config_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create config directory: {:?}", parent))?;
    }
    let json = serde_json::to_string_pretty(config)
        .context("Failed to serialize config")?;
    fs::write(&path, json)
        .with_context(|| format!("Failed to write config file: {:?}", path))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::{CloudProvider, CloudTtsConfig, EngineType, PiperTtsConfig, SystemTtsConfig};

    #[test]
    fn config_dir_is_under_neko_tts() {
        let dir = config_dir().unwrap();
        assert!(dir.ends_with("neko-tts"));
    }

    #[test]
    fn config_file_path_is_json() {
        let path = config_file_path().unwrap();
        assert_eq!(path.file_name().unwrap(), "config.json");
        assert!(path.parent().unwrap().ends_with("neko-tts"));
    }

    #[test]
    fn load_config_returns_default_when_no_file() {
        // load_config should never panic — it returns defaults on error
        let config = load_config();
        assert_eq!(config.active_engine, EngineType::System);
        assert_eq!(config.default_rate, 1.0);
    }

    #[test]
    fn save_and_load_config_round_trip() {
        let config = TtsConfig {
            active_engine: EngineType::Cloud,
            system: SystemTtsConfig { voice: Some("test-voice".to_string()) },
            piper: PiperTtsConfig {
                model_path: Some("/tmp/model.onnx".to_string()),
                piper_binary: None,
            },
            cloud: CloudTtsConfig {
                provider: CloudProvider::Google,
                api_key: Some("test-key".to_string()),
                voice: Some("en-US-Wavenet-D".to_string()),
                endpoint: None,
            },
            default_rate: 1.3,
            default_pitch: 0.9,
            default_volume: 0.7,
        };

        // Save
        let result = save_config(&config);
        assert!(result.is_ok(), "save_config failed: {:?}", result.err());

        // Load back
        let loaded = load_config();
        assert_eq!(loaded.active_engine, EngineType::Cloud);
        assert_eq!(loaded.system.voice.as_deref(), Some("test-voice"));
        assert_eq!(loaded.cloud.provider, CloudProvider::Google);
        assert_eq!(loaded.cloud.api_key.as_deref(), Some("test-key"));
        assert_eq!(loaded.default_rate, 1.3);
        assert_eq!(loaded.default_pitch, 0.9);
        assert_eq!(loaded.default_volume, 0.7);

        // Clean up: restore defaults
        let _ = save_config(&TtsConfig::default());
    }
}
