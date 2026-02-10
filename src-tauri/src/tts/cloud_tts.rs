use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

use super::engine::TtsEngine;
use super::types::{CloudProvider, TtsRequest, TtsResult, VoiceInfo};

/// Cloud-based TTS engine supporting OpenAI, Azure, and Google.
pub struct CloudTtsEngine {
    provider: CloudProvider,
    api_key: String,
    voice: String,
    endpoint: Option<String>,
    client: Client,
}

impl CloudTtsEngine {
    pub fn new(
        provider: CloudProvider,
        api_key: String,
        voice: Option<String>,
        endpoint: Option<String>,
    ) -> Self {
        let default_voice = match provider {
            CloudProvider::OpenAI => "alloy".to_string(),
            CloudProvider::Azure => "en-US-JennyNeural".to_string(),
            CloudProvider::Google => "en-US-Standard-C".to_string(),
        };
        Self {
            provider,
            api_key,
            voice: voice.unwrap_or(default_voice),
            endpoint,
            client: Client::new(),
        }
    }

    async fn synthesize_openai(&self, request: &TtsRequest) -> Result<TtsResult> {
        let url = self
            .endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1/audio/speech");

        let speed = request.rate.unwrap_or(1.0);
        let voice = request.voice.as_deref().unwrap_or(&self.voice);

        let body = json!({
            "model": "tts-1",
            "input": request.text,
            "voice": voice,
            "speed": speed,
            "response_format": "wav",
        });

        let resp = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("OpenAI TTS API error {}: {}", status, text));
        }

        let audio_data = resp.bytes().await?.to_vec();

        Ok(TtsResult {
            audio_data,
            sample_rate: 24000,
            channels: 1,
            format: "wav".to_string(),
        })
    }

    async fn synthesize_azure(&self, request: &TtsRequest) -> Result<TtsResult> {
        let endpoint = self
            .endpoint
            .as_deref()
            .ok_or_else(|| anyhow!("Azure TTS requires an endpoint (e.g. https://eastus.tts.speech.microsoft.com/cognitiveservices/v1)"))?;

        let voice = request.voice.as_deref().unwrap_or(&self.voice);
        let rate = request.rate.unwrap_or(1.0);
        let rate_pct = ((rate - 1.0) * 100.0) as i32;
        let pitch = request.pitch.unwrap_or(1.0);
        let pitch_pct = ((pitch - 1.0) * 50.0) as i32;

        let ssml = format!(
            r#"<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="{}">
                    <prosody rate="{}%" pitch="{}%">{}</prosody>
                </voice>
            </speak>"#,
            voice,
            rate_pct,
            pitch_pct,
            quick_xml_escape(&request.text)
        );

        let resp = self
            .client
            .post(endpoint)
            .header("Ocp-Apim-Subscription-Key", &self.api_key)
            .header("Content-Type", "application/ssml+xml")
            .header(
                "X-Microsoft-OutputFormat",
                "riff-24khz-16bit-mono-pcm",
            )
            .body(ssml)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Azure TTS API error {}: {}", status, text));
        }

        let audio_data = resp.bytes().await?.to_vec();

        Ok(TtsResult {
            audio_data,
            sample_rate: 24000,
            channels: 1,
            format: "wav".to_string(),
        })
    }

    async fn synthesize_google(&self, request: &TtsRequest) -> Result<TtsResult> {
        let url = format!(
            "https://texttospeech.googleapis.com/v1/text:synthesize?key={}",
            self.api_key
        );

        let voice = request.voice.as_deref().unwrap_or(&self.voice);
        let rate = request.rate.unwrap_or(1.0);
        let pitch = request.pitch.unwrap_or(1.0);
        // Google pitch is in semitones: -20.0 to 20.0, default 0
        let pitch_semitones = (pitch - 1.0) * 10.0;

        let body = json!({
            "input": { "text": request.text },
            "voice": {
                "languageCode": "en-US",
                "name": voice,
            },
            "audioConfig": {
                "audioEncoding": "LINEAR16",
                "speakingRate": rate,
                "pitch": pitch_semitones,
                "sampleRateHertz": 24000,
            }
        });

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Google TTS API error {}: {}", status, text));
        }

        let json_resp: serde_json::Value = resp.json().await?;
        let audio_b64 = json_resp["audioContent"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing audioContent in Google TTS response"))?;

        use base64::Engine;
        let audio_data = base64::engine::general_purpose::STANDARD.decode(audio_b64)?;

        Ok(TtsResult {
            audio_data,
            sample_rate: 24000,
            channels: 1,
            format: "wav".to_string(),
        })
    }
}

#[async_trait]
impl TtsEngine for CloudTtsEngine {
    fn name(&self) -> &str {
        match self.provider {
            CloudProvider::OpenAI => "OpenAI TTS",
            CloudProvider::Azure => "Azure TTS",
            CloudProvider::Google => "Google TTS",
        }
    }

    async fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    async fn list_voices(&self) -> Result<Vec<VoiceInfo>> {
        // Return commonly used voices for each provider
        let voices = match self.provider {
            CloudProvider::OpenAI => vec![
                ("alloy", "Alloy"),
                ("echo", "Echo"),
                ("fable", "Fable"),
                ("onyx", "Onyx"),
                ("nova", "Nova"),
                ("shimmer", "Shimmer"),
            ],
            CloudProvider::Azure => vec![
                ("en-US-JennyNeural", "Jenny (US)"),
                ("en-US-GuyNeural", "Guy (US)"),
                ("en-GB-SoniaNeural", "Sonia (UK)"),
                ("zh-CN-XiaoxiaoNeural", "Xiaoxiao (CN)"),
                ("ja-JP-NanamiNeural", "Nanami (JP)"),
            ],
            CloudProvider::Google => vec![
                ("en-US-Standard-C", "Standard C (US Female)"),
                ("en-US-Standard-D", "Standard D (US Male)"),
                ("en-US-Wavenet-C", "Wavenet C (US Female)"),
                ("en-US-Wavenet-D", "Wavenet D (US Male)"),
            ],
        };

        Ok(voices
            .into_iter()
            .map(|(id, name)| VoiceInfo {
                id: id.to_string(),
                name: name.to_string(),
                language: Some("en-US".to_string()),
            })
            .collect())
    }

    async fn synthesize(&self, request: &TtsRequest) -> Result<TtsResult> {
        match self.provider {
            CloudProvider::OpenAI => self.synthesize_openai(request).await,
            CloudProvider::Azure => self.synthesize_azure(request).await,
            CloudProvider::Google => self.synthesize_google(request).await,
        }
    }
}

/// Simple XML escape for SSML content
fn quick_xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
