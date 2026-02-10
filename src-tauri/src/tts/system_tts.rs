use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::process::Stdio;
use tokio::process::Command;

use super::engine::TtsEngine;
use super::types::{TtsRequest, TtsResult, VoiceInfo};

/// System TTS engine that calls platform-native TTS via subprocess.
///
/// - Linux:   espeak-ng / espeak / spd-say
/// - macOS:   say
/// - Windows: PowerShell + System.Speech (SAPI)
pub struct SystemTtsEngine {
    /// Which backend binary was detected
    backend: SystemBackend,
}

#[derive(Debug, Clone)]
enum SystemBackend {
    #[cfg(target_os = "linux")]
    EspeakNg,
    #[cfg(target_os = "linux")]
    Espeak,
    #[cfg(target_os = "macos")]
    Say,
    #[cfg(target_os = "windows")]
    Sapi,
    None,
}

impl SystemTtsEngine {
    pub async fn new() -> Self {
        let backend = Self::detect_backend().await;
        Self { backend }
    }

    async fn detect_backend() -> SystemBackend {
        #[cfg(target_os = "linux")]
        {
            if Self::command_exists("espeak-ng").await {
                return SystemBackend::EspeakNg;
            }
            if Self::command_exists("espeak").await {
                return SystemBackend::Espeak;
            }
            SystemBackend::None
        }

        #[cfg(target_os = "macos")]
        {
            SystemBackend::Say
        }

        #[cfg(target_os = "windows")]
        {
            SystemBackend::Sapi
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        {
            SystemBackend::None
        }
    }

    async fn command_exists(cmd: &str) -> bool {
        Command::new("which")
            .arg(cmd)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

#[async_trait]
impl TtsEngine for SystemTtsEngine {
    fn name(&self) -> &str {
        "System TTS"
    }

    async fn is_available(&self) -> bool {
        !matches!(self.backend, SystemBackend::None)
    }

    async fn list_voices(&self) -> Result<Vec<VoiceInfo>> {
        match &self.backend {
            #[cfg(target_os = "linux")]
            SystemBackend::EspeakNg | SystemBackend::Espeak => {
                let cmd = match &self.backend {
                    SystemBackend::EspeakNg => "espeak-ng",
                    SystemBackend::Espeak => "espeak",
                    _ => unreachable!(),
                };
                let output = Command::new(cmd).arg("--voices").output().await?;
                let text = String::from_utf8_lossy(&output.stdout);
                let voices: Vec<VoiceInfo> = text
                    .lines()
                    .skip(1) // header line
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 4 {
                            Some(VoiceInfo {
                                id: parts[4].to_string(),
                                name: parts[3].to_string(),
                                language: Some(parts[1].to_string()),
                            })
                        } else {
                            None
                        }
                    })
                    .collect();
                Ok(voices)
            }

            #[cfg(target_os = "macos")]
            SystemBackend::Say => {
                let output = Command::new("say").arg("-v").arg("?").output().await?;
                let text = String::from_utf8_lossy(&output.stdout);
                let voices: Vec<VoiceInfo> = text
                    .lines()
                    .filter_map(|line| {
                        let name = line.split_whitespace().next()?;
                        let lang = line.find('#').and_then(|_| {
                            // format: "Name  lang_REGION  # comment"
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            parts.get(1).map(|s| s.to_string())
                        });
                        Some(VoiceInfo {
                            id: name.to_string(),
                            name: name.to_string(),
                            language: lang,
                        })
                    })
                    .collect();
                Ok(voices)
            }

            #[cfg(target_os = "windows")]
            SystemBackend::Sapi => {
                let ps_script = r#"
                    Add-Type -AssemblyName System.Speech
                    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                    $synth.GetInstalledVoices() | ForEach-Object {
                        $v = $_.VoiceInfo
                        "$($v.Name)|$($v.Culture.Name)"
                    }
                "#;
                let output = Command::new("powershell")
                    .args(["-NoProfile", "-Command", ps_script])
                    .output()
                    .await?;
                let text = String::from_utf8_lossy(&output.stdout);
                let voices: Vec<VoiceInfo> = text
                    .lines()
                    .filter(|l| !l.is_empty())
                    .map(|line| {
                        let parts: Vec<&str> = line.splitn(2, '|').collect();
                        VoiceInfo {
                            id: parts[0].to_string(),
                            name: parts[0].to_string(),
                            language: parts.get(1).map(|s| s.to_string()),
                        }
                    })
                    .collect();
                Ok(voices)
            }

            SystemBackend::None => Ok(vec![]),
        }
    }

    async fn synthesize(&self, request: &TtsRequest) -> Result<TtsResult> {
        let rate = request.rate.unwrap_or(1.0);
        let _pitch = request.pitch.unwrap_or(1.0);
        let _volume = request.volume.unwrap_or(1.0);

        match &self.backend {
            #[cfg(target_os = "linux")]
            SystemBackend::EspeakNg | SystemBackend::Espeak => {
                let cmd = match &self.backend {
                    SystemBackend::EspeakNg => "espeak-ng",
                    SystemBackend::Espeak => "espeak",
                    _ => unreachable!(),
                };
                // espeak outputs WAV to stdout with --stdout
                let wpm = (175.0 * rate) as u32; // default espeak rate is ~175 wpm
                let mut args = vec!["--stdout".to_string(), "-s".to_string(), wpm.to_string()];
                if let Some(ref voice) = request.voice {
                    args.push("-v".to_string());
                    args.push(voice.clone());
                }
                args.push(request.text.clone());

                let output = Command::new(cmd).args(&args).output().await?;

                if !output.status.success() {
                    let err = String::from_utf8_lossy(&output.stderr);
                    return Err(anyhow!("espeak failed: {}", err));
                }

                Ok(TtsResult {
                    audio_data: output.stdout,
                    sample_rate: 22050,
                    channels: 1,
                    format: "wav".to_string(),
                })
            }

            #[cfg(target_os = "macos")]
            SystemBackend::Say => {
                use tokio::fs;
                let tmp =
                    std::env::temp_dir().join(format!("neko_tts_{}.aiff", std::process::id()));
                let mut args = vec!["-o".to_string(), tmp.to_string_lossy().to_string()];
                if let Some(ref voice) = request.voice {
                    args.push("-v".to_string());
                    args.push(voice.clone());
                }
                let rate_wpm = (175.0 * rate) as u32;
                args.push("-r".to_string());
                args.push(rate_wpm.to_string());
                args.push(request.text.clone());

                let status = Command::new("say").args(&args).status().await?;
                if !status.success() {
                    return Err(anyhow!("macOS say command failed"));
                }

                let audio_data = fs::read(&tmp).await?;
                let _ = fs::remove_file(&tmp).await;

                Ok(TtsResult {
                    audio_data,
                    sample_rate: 22050,
                    channels: 1,
                    format: "aiff".to_string(),
                })
            }

            #[cfg(target_os = "windows")]
            SystemBackend::Sapi => {
                let tmp = std::env::temp_dir().join(format!("neko_tts_{}.wav", std::process::id()));
                let tmp_str = tmp.to_string_lossy().to_string();
                let voice_select = if let Some(ref voice) = request.voice {
                    format!(r#"$synth.SelectVoice("{}")"#, voice)
                } else {
                    String::new()
                };
                let ps_script = format!(
                    r#"
                    Add-Type -AssemblyName System.Speech
                    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                    {}
                    $synth.Rate = {}
                    $synth.SetOutputToWaveFile("{}")
                    $synth.Speak("{}")
                    $synth.Dispose()
                    "#,
                    voice_select,
                    ((rate - 1.0) * 10.0) as i32, // SAPI rate: -10 to 10
                    tmp_str,
                    request.text.replace('"', "`\"")
                );

                let status = Command::new("powershell")
                    .args(["-NoProfile", "-Command", &ps_script])
                    .status()
                    .await?;

                if !status.success() {
                    return Err(anyhow!("Windows SAPI TTS failed"));
                }

                let audio_data = tokio::fs::read(&tmp).await?;
                let _ = tokio::fs::remove_file(&tmp).await;

                Ok(TtsResult {
                    audio_data,
                    sample_rate: 22050,
                    channels: 1,
                    format: "wav".to_string(),
                })
            }

            SystemBackend::None => Err(anyhow!("No system TTS backend available")),
        }
    }
}
