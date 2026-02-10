use anyhow::{anyhow, Result};
use rodio::{Decoder, OutputStream, Sink};
use std::io::Cursor;
use std::sync::mpsc;
use std::sync::Mutex as StdMutex;
use std::thread;

use super::types::TtsResult;

/// Commands sent to the audio player thread
#[allow(dead_code)]
enum PlayerCommand {
    Play(Vec<u8>),
    Stop,
    Pause,
    Resume,
    SetVolume(f32),
    Shutdown,
}

/// Responses from the audio player thread
#[derive(Debug)]
enum PlayerResponse {
    Ok,
    Error(String),
}

/// Audio player that runs on a dedicated thread (because rodio's OutputStream is !Send).
/// Communication happens via channels.
pub struct AudioPlayer {
    cmd_tx: mpsc::Sender<PlayerCommand>,
    resp_rx: StdMutex<mpsc::Receiver<PlayerResponse>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self> {
        let (cmd_tx, cmd_rx) = mpsc::channel::<PlayerCommand>();
        let (resp_tx, resp_rx) = mpsc::channel::<PlayerResponse>();

        // Spawn a dedicated thread for audio playback
        thread::spawn(move || {
            // Initialize audio output on this thread
            let (stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    let _ = resp_tx.send(PlayerResponse::Error(format!(
                        "Failed to open audio output: {}",
                        e
                    )));
                    return;
                }
            };
            // Keep stream alive
            let _stream = stream;

            let sink = match Sink::try_new(&stream_handle) {
                Ok(s) => s,
                Err(e) => {
                    let _ = resp_tx.send(PlayerResponse::Error(format!(
                        "Failed to create audio sink: {}",
                        e
                    )));
                    return;
                }
            };

            // Signal that initialization succeeded
            let _ = resp_tx.send(PlayerResponse::Ok);

            // Process commands
            while let Ok(cmd) = cmd_rx.recv() {
                match cmd {
                    PlayerCommand::Play(audio_data) => {
                        let cursor = Cursor::new(audio_data);
                        match Decoder::new(cursor) {
                            Ok(source) => {
                                sink.stop();
                                sink.append(source);
                                sink.play();
                                let _ = resp_tx.send(PlayerResponse::Ok);
                            }
                            Err(e) => {
                                let _ = resp_tx.send(PlayerResponse::Error(format!(
                                    "Failed to decode audio: {}",
                                    e
                                )));
                            }
                        }
                    }
                    PlayerCommand::Stop => {
                        sink.stop();
                        let _ = resp_tx.send(PlayerResponse::Ok);
                    }
                    PlayerCommand::Pause => {
                        sink.pause();
                        let _ = resp_tx.send(PlayerResponse::Ok);
                    }
                    PlayerCommand::Resume => {
                        sink.play();
                        let _ = resp_tx.send(PlayerResponse::Ok);
                    }
                    PlayerCommand::SetVolume(vol) => {
                        sink.set_volume(vol.clamp(0.0, 1.0));
                        let _ = resp_tx.send(PlayerResponse::Ok);
                    }
                    PlayerCommand::Shutdown => {
                        sink.stop();
                        let _ = resp_tx.send(PlayerResponse::Ok);
                        break;
                    }
                }
            }
        });

        // Wait for initialization response
        let init_resp = resp_rx
            .recv()
            .map_err(|_| anyhow!("Audio player thread died during init"))?;

        match init_resp {
            PlayerResponse::Ok => Ok(Self {
                cmd_tx,
                resp_rx: StdMutex::new(resp_rx),
            }),
            PlayerResponse::Error(e) => Err(anyhow!("Audio player init failed: {}", e)),
        }
    }

    fn send_cmd(&self, cmd: PlayerCommand) -> Result<()> {
        self.cmd_tx
            .send(cmd)
            .map_err(|_| anyhow!("Audio player thread not responding"))?;
        let rx = self
            .resp_rx
            .lock()
            .map_err(|e| anyhow!("Lock error: {}", e))?;
        match rx.recv() {
            Ok(PlayerResponse::Ok) => Ok(()),
            Ok(PlayerResponse::Error(e)) => Err(anyhow!("{}", e)),
            Err(_) => Err(anyhow!("Audio player thread died")),
        }
    }

    /// Play audio from a TtsResult (WAV/AIFF bytes).
    pub fn play(&self, result: &TtsResult) -> Result<()> {
        self.send_cmd(PlayerCommand::Play(result.audio_data.clone()))
    }

    /// Stop playback immediately.
    pub fn stop(&self) -> Result<()> {
        self.send_cmd(PlayerCommand::Stop)
    }

    /// Pause playback.
    pub fn pause(&self) -> Result<()> {
        self.send_cmd(PlayerCommand::Pause)
    }

    /// Resume playback.
    pub fn resume(&self) -> Result<()> {
        self.send_cmd(PlayerCommand::Resume)
    }

    /// Set volume (0.0 - 1.0).
    #[allow(dead_code)]
    pub fn set_volume(&self, volume: f32) -> Result<()> {
        self.send_cmd(PlayerCommand::SetVolume(volume))
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        let _ = self.cmd_tx.send(PlayerCommand::Shutdown);
    }
}
