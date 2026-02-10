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
