#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod server;
mod tts;

use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, CustomMenuItem, GlobalShortcutManager, Manager, State, SystemTray, SystemTrayEvent,
    SystemTrayMenu, SystemTrayMenuItem, WindowBuilder, WindowEvent, WindowUrl,
};
use tokio::sync::Mutex;
use tts::{EngineType, TtsConfig, TtsManager, TtsRequest, VoiceInfo};

use server::ServerProcess;

/// Shared app state — wraps TtsManager in a tokio Mutex for async access.
pub struct AppState {
    tts_manager: Mutex<TtsManager>,
    clipboard_monitor_enabled: Arc<AtomicBool>,
    server: Mutex<ServerProcess>,
}

// SAFETY: TtsManager fields are all Send+Sync (see previous comments)
unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

// ─── Tauri Commands ───────────────────────────────────────────────

#[tauri::command]
async fn speak(
    state: State<'_, AppState>,
    text: String,
    engine: Option<String>,
) -> Result<(), String> {
    let engine_type = engine.map(|e| match e.as_str() {
        "system" => EngineType::System,
        "piper" => EngineType::Piper,
        "cloud" => EngineType::Cloud,
        _ => EngineType::System,
    });

    let request = TtsRequest {
        text,
        engine: engine_type,
        voice: None,
        rate: None,
        pitch: None,
        volume: None,
    };

    let manager = state.tts_manager.lock().await;
    manager.speak(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_speaking(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.tts_manager.lock().await;
    manager.stop().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn pause_speaking(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.tts_manager.lock().await;
    manager.pause().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn resume_speaking(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.tts_manager.lock().await;
    manager.resume().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_playback_state(state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.tts_manager.lock().await;
    let s = manager.get_state().await;
    Ok(format!("{:?}", s))
}

#[tauri::command]
async fn list_voices(state: State<'_, AppState>, engine: String) -> Result<Vec<VoiceInfo>, String> {
    let engine_type = match engine.as_str() {
        "system" => EngineType::System,
        "piper" => EngineType::Piper,
        "cloud" => EngineType::Cloud,
        _ => return Err("Unknown engine type".to_string()),
    };
    let manager = state.tts_manager.lock().await;
    manager
        .list_voices(&engine_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_available_engines(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let manager = state.tts_manager.lock().await;
    let engines = manager.get_available_engines().await;
    Ok(engines.iter().map(|e| format!("{:?}", e)).collect())
}

#[tauri::command]
async fn get_tts_config(state: State<'_, AppState>) -> Result<TtsConfig, String> {
    let manager = state.tts_manager.lock().await;
    Ok(manager.get_config().await)
}

#[tauri::command]
async fn update_tts_config(state: State<'_, AppState>, config: TtsConfig) -> Result<(), String> {
    // Persist to disk
    config::save_config(&config).map_err(|e| e.to_string())?;
    // Update in-memory
    let manager = state.tts_manager.lock().await;
    manager.update_config(config).await;
    Ok(())
}

#[tauri::command]
async fn toggle_clipboard_monitor(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.clipboard_monitor_enabled.load(Ordering::Relaxed);
    let new_state = !current;
    state
        .clipboard_monitor_enabled
        .store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

#[tauri::command]
async fn open_studio(app_handle: AppHandle) -> Result<(), String> {
    // If studio window already exists, just show & focus it
    if let Some(window) = app_handle.get_window("studio") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // Create the studio window immediately (no blocking on server)
    let _window = WindowBuilder::new(&app_handle, "studio", WindowUrl::App("index.html".into()))
        .title("Neko TTS — Studio")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .decorations(false)
        .always_on_top(false)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Start the voicebox-server and wait for it to become healthy.
/// Called by the Studio frontend after the window is open.
#[tauri::command]
async fn start_server(state: State<'_, AppState>, remote: Option<bool>) -> Result<String, String> {
    let _ = remote; // reserved for future remote-server support
    let mut srv = state.server.lock().await;

    if !srv.is_running() {
        // Quick check: maybe an external instance is already up
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .map_err(|e| e.to_string())?;
        let health_url = format!("{}/health", srv.server_url());
        let already_up = client.get(&health_url).send().await.is_ok();

        if !already_up {
            srv.start()
                .await
                .map_err(|e| format!("Failed to start server: {}", e))?;
        }
    }

    // Wait for server to be ready
    srv.health_check()
        .await
        .map_err(|e| format!("Server health check failed: {}", e))?;

    Ok(srv.server_url().to_string())
}

/// Stop the voicebox-server.
#[tauri::command]
async fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut srv = state.server.lock().await;
    srv.stop().await.map_err(|e| e.to_string())
}

/// Hint to keep the server running even after studio closes.
#[tauri::command]
async fn set_keep_server_running(_keep: bool) -> Result<(), String> {
    // TODO: implement keep-alive flag if needed
    Ok(())
}

// ─── Audio Commands (stubs – real impl requires cpal/rodio) ──────

#[derive(serde::Serialize)]
struct AudioDevice {
    id: String,
    name: String,
    is_default: bool,
}

#[tauri::command]
async fn start_system_audio_capture(_max_duration_secs: f64) -> Result<(), String> {
    // TODO: implement with cpal
    Err("System audio capture not yet implemented".to_string())
}

#[tauri::command]
async fn stop_system_audio_capture() -> Result<Vec<u8>, String> {
    Err("System audio capture not yet implemented".to_string())
}

#[tauri::command]
async fn list_output_devices() -> Result<Vec<AudioDevice>, String> {
    // Return empty list until real audio device enumeration is added
    Ok(vec![])
}

#[tauri::command]
async fn play_to_devices(_audio_data: Vec<u8>, _device_ids: Vec<String>) -> Result<(), String> {
    Err("Multi-device playback not yet implemented".to_string())
}

#[tauri::command]
async fn stop_playback() -> Result<(), String> {
    Ok(())
}

// ─── System Tray ──────────────────────────────────────────────────

fn create_system_tray() -> SystemTray {
    let show_hide = CustomMenuItem::new("show_hide".to_string(), "Show/Hide");
    let quick_input = CustomMenuItem::new("quick_input".to_string(), "Quick Input");
    let clipboard_monitor =
        CustomMenuItem::new("clipboard_monitor".to_string(), "Clipboard Monitor: OFF");
    let settings = CustomMenuItem::new("settings".to_string(), "Settings");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show_hide)
        .add_item(quick_input)
        .add_item(clipboard_monitor)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(settings)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

fn handle_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            // Toggle main window visibility on left click
            if let Some(window) = app.get_window("cat") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
                "show_hide" => {
                    if let Some(window) = app.get_window("cat") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                "quick_input" => {
                    if let Some(window) = app.get_window("cat") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Emit event to frontend to open input bubble
                        let _ = window.emit("open-input", ());
                    }
                }
                "clipboard_monitor" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let current = state.clipboard_monitor_enabled.load(Ordering::Relaxed);
                        let new_state = !current;
                        state
                            .clipboard_monitor_enabled
                            .store(new_state, Ordering::Relaxed);

                        // Update tray menu item text
                        let text = if new_state {
                            "Clipboard Monitor: ON"
                        } else {
                            "Clipboard Monitor: OFF"
                        };
                        let tray = app.tray_handle();
                        let _ = tray.get_item("clipboard_monitor").set_title(text);
                    }
                }
                "settings" => {
                    // If settings window already exists, just show & focus it
                    if let Some(window) = app.get_window("settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        // Create a new settings window
                        let _window = WindowBuilder::new(
                            app,
                            "settings",
                            WindowUrl::App("index.html".into()),
                        )
                        .title("Neko TTS — Settings")
                        .inner_size(520.0, 560.0)
                        .min_inner_size(420.0, 480.0)
                        .resizable(true)
                        .decorations(true)
                        .always_on_top(false)
                        .center()
                        .build();
                    }
                }
                "quit" => {
                    // Shutdown voicebox-server before quitting
                    let app_clone = app.clone();
                    tauri::async_runtime::block_on(async {
                        if let Some(state) = app_clone.try_state::<AppState>() {
                            let mut srv = state.server.lock().await;
                            let _ = srv.stop().await;
                        }
                    });
                    app.exit(0);
                }
                _ => {}
            }
        }
        _ => {}
    }
}

// ─── Clipboard Monitor ────────────────────────────────────────────

fn start_clipboard_monitor(app_handle: AppHandle, monitor_enabled: Arc<AtomicBool>) {
    thread::spawn(move || {
        let mut clipboard = match Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                eprintln!("Failed to initialize clipboard: {}", e);
                return;
            }
        };

        let mut last_text = String::new();

        loop {
            thread::sleep(Duration::from_secs(1));

            if !monitor_enabled.load(Ordering::Relaxed) {
                continue;
            }

            if let Ok(text) = clipboard.get_text() {
                if text != last_text && !text.trim().is_empty() {
                    last_text = text.clone();

                    // Emit clipboard text to frontend
                    if let Some(window) = app_handle.get_window("cat") {
                        let _ = window.emit("clipboard-text", text);
                    }
                }
            }
        }
    });
}

// ─── Global Hotkeys ───────────────────────────────────────────────

fn register_global_hotkeys(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // Ctrl+Shift+S - Toggle input bubble
    app.global_shortcut_manager()
        .register("CmdOrCtrl+Shift+S", move || {
            if let Some(window) = app_handle.get_window("cat") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("toggle-input", ());
            }
        })?;

    let app_handle2 = app.clone();

    // Ctrl+Shift+R - Read clipboard content
    app.global_shortcut_manager()
        .register("CmdOrCtrl+Shift+R", move || {
            if let Some(window) = app_handle2.get_window("cat") {
                // Read clipboard and send text to frontend
                if let Ok(mut clipboard) = Clipboard::new() {
                    if let Ok(text) = clipboard.get_text() {
                        if !text.trim().is_empty() {
                            let _ = window.emit("read-clipboard", text);
                        }
                    }
                }
            }
        })?;

    Ok(())
}

// ─── Main ─────────────────────────────────────────────────────────

fn main() {
    let runtime = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

    let tts_manager = runtime.block_on(async {
        // Load persisted config (or defaults)
        let config = config::load_config();
        println!("Loaded TTS config: engine={:?}", config.active_engine);
        TtsManager::new(config).await
    });

    let clipboard_monitor_enabled = Arc::new(AtomicBool::new(false));

    let app_state = AppState {
        tts_manager: Mutex::new(tts_manager),
        clipboard_monitor_enabled: clipboard_monitor_enabled.clone(),
        server: Mutex::new(ServerProcess::new()),
    };

    let system_tray = create_system_tray();

    tauri::Builder::default()
        .manage(app_state)
        .system_tray(system_tray)
        .on_system_tray_event(handle_system_tray_event)
        .setup(|app| {
            // Register global hotkeys
            if let Err(e) = register_global_hotkeys(&app.handle()) {
                eprintln!("Failed to register global hotkeys: {}", e);
            }

            // Start clipboard monitor
            start_clipboard_monitor(app.handle().clone(), clipboard_monitor_enabled);

            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                let label = event.window().label().to_string();
                match label.as_str() {
                    // Hide the main cat window instead of closing
                    "cat" => {
                        event.window().hide().unwrap();
                        api.prevent_close();
                    }
                    // When studio closes, shutdown the voicebox-server
                    "studio" => {
                        let app_handle = event.window().app_handle();
                        tauri::async_runtime::spawn(async move {
                            if let Some(state) = app_handle.try_state::<AppState>() {
                                let mut srv = state.server.lock().await;
                                let _ = srv.stop().await;
                            }
                        });
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            speak,
            stop_speaking,
            pause_speaking,
            resume_speaking,
            get_playback_state,
            list_voices,
            get_available_engines,
            get_tts_config,
            update_tts_config,
            toggle_clipboard_monitor,
            open_studio,
            start_server,
            stop_server,
            set_keep_server_running,
            start_system_audio_capture,
            stop_system_audio_capture,
            list_output_devices,
            play_to_devices,
            stop_playback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
