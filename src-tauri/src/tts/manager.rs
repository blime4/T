use anyhow::{anyhow, Result};
use std::sync::Arc;
use tokio::sync::Mutex;

use super::cloud_tts::CloudTtsEngine;
use super::engine::TtsEngine;
use super::piper_tts::PiperTtsEngine;
use super::player::AudioPlayer;
use super::system_tts::SystemTtsEngine;
use super::types::*;

/// Central TTS manager that coordinates engines, playback, and state.
pub struct TtsManager {
    system_engine: SystemTtsEngine,
    piper_engine: PiperTtsEngine,
    cloud_engine: Option<CloudTtsEngine>,
    player: Option<AudioPlayer>,
    config: Arc<Mutex<TtsConfig>>,
    state: Arc<Mutex<PlaybackState>>,
}

// AudioPlayer is Send+Sync (channel-based), all other fields are Send+Sync
unsafe impl Send for TtsManager {}
unsafe impl Sync for TtsManager {}

impl TtsManager {
    pub async fn new(config: TtsConfig) -> Self {
        let system_engine = SystemTtsEngine::new().await;
        let piper_engine = PiperTtsEngine::new(
            config.piper.piper_binary.clone(),
            config.piper.model_path.clone(),
        );

        let cloud_engine = if let Some(ref api_key) = config.cloud.api_key {
            if !api_key.is_empty() {
                Some(CloudTtsEngine::new(
                    config.cloud.provider.clone(),
                    api_key.clone(),
                    config.cloud.voice.clone(),
                    config.cloud.endpoint.clone(),
                ))
            } else {
                None
            }
        } else {
            None
        };

        // Try to create audio player (may fail if no audio device)
        let player = match AudioPlayer::new() {
            Ok(p) => Some(p),
            Err(e) => {
                eprintln!("Warning: Could not initialize audio player: {}", e);
                None
            }
        };

        Self {
            system_engine,
            piper_engine,
            cloud_engine,
            player,
            config: Arc::new(Mutex::new(config)),
            state: Arc::new(Mutex::new(PlaybackState::Idle)),
        }
    }

    /// Speak text using the active engine.
    pub async fn speak(&self, request: TtsRequest) -> Result<()> {
        let config = self.config.lock().await;
        let engine_type = request
            .engine
            .as_ref()
            .unwrap_or(&config.active_engine)
            .clone();

        // Fill in defaults from config
        let request = TtsRequest {
            text: request.text,
            engine: request.engine,
            voice: request.voice,
            rate: Some(request.rate.unwrap_or(config.default_rate)),
            pitch: Some(request.pitch.unwrap_or(config.default_pitch)),
            volume: Some(request.volume.unwrap_or(config.default_volume)),
        };
        drop(config);

        // Update state
        *self.state.lock().await = PlaybackState::Synthesizing;

        // Synthesize
        let result = match engine_type {
            EngineType::System => self.system_engine.synthesize(&request).await,
            EngineType::Piper => self.piper_engine.synthesize(&request).await,
            EngineType::Cloud => match self.cloud_engine.as_ref() {
                Some(e) => e.synthesize(&request).await,
                None => Err(anyhow!("Cloud TTS not configured")),
            },
        };

        match result {
            Ok(tts_result) => {
                // Play audio
                if let Some(ref p) = self.player {
                    *self.state.lock().await = PlaybackState::Playing;
                    p.play(&tts_result)?;
                } else {
                    *self.state.lock().await = PlaybackState::Error;
                    return Err(anyhow!("No audio output device available"));
                }
                Ok(())
            }
            Err(e) => {
                *self.state.lock().await = PlaybackState::Error;
                Err(e)
            }
        }
    }

    /// Stop playback.
    pub async fn stop(&self) -> Result<()> {
        if let Some(ref p) = self.player {
            p.stop()?;
        }
        *self.state.lock().await = PlaybackState::Idle;
        Ok(())
    }

    /// Pause playback.
    pub async fn pause(&self) -> Result<()> {
        if let Some(ref p) = self.player {
            p.pause()?;
        }
        *self.state.lock().await = PlaybackState::Paused;
        Ok(())
    }

    /// Resume playback.
    pub async fn resume(&self) -> Result<()> {
        if let Some(ref p) = self.player {
            p.resume()?;
        }
        *self.state.lock().await = PlaybackState::Playing;
        Ok(())
    }

    /// Get current playback state.
    pub async fn get_state(&self) -> PlaybackState {
        self.state.lock().await.clone()
    }

    /// List voices for a given engine type.
    pub async fn list_voices(&self, engine_type: &EngineType) -> Result<Vec<VoiceInfo>> {
        match engine_type {
            EngineType::System => self.system_engine.list_voices().await,
            EngineType::Piper => self.piper_engine.list_voices().await,
            EngineType::Cloud => match self.cloud_engine.as_ref() {
                Some(e) => e.list_voices().await,
                None => Ok(vec![]),
            },
        }
    }

    /// Check which engines are available.
    pub async fn get_available_engines(&self) -> Vec<EngineType> {
        let mut engines = Vec::new();
        if self.system_engine.is_available().await {
            engines.push(EngineType::System);
        }
        if self.piper_engine.is_available().await {
            engines.push(EngineType::Piper);
        }
        if let Some(ref e) = self.cloud_engine {
            if e.is_available().await {
                engines.push(EngineType::Cloud);
            }
        }
        engines
    }

    /// Update configuration.
    pub async fn update_config(&self, new_config: TtsConfig) {
        // Note: For piper/cloud engine reconfiguration, we'd need &mut self.
        // For now, just update the stored config. Engine reconfiguration
        // will be handled by recreating the manager or via interior mutability later.
        *self.config.lock().await = new_config;
    }

    /// Get current config.
    pub async fn get_config(&self) -> TtsConfig {
        self.config.lock().await.clone()
    }
}
