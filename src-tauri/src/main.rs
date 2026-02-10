#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod tts;

use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, CustomMenuItem, GlobalShortcutManager, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, WindowBuilder, WindowUrl, WindowEvent,
};
use tokio::sync::Mutex;
use tts::{EngineType, TtsConfig, TtsManager, TtsRequest, VoiceInfo};

/// Shared app state — wraps TtsManager in a tokio Mutex for async access.
pub struct AppState {
    tts_manager: Mutex<TtsManager>,
    clipboard_monitor_enabled: Arc<AtomicBool>,
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
async fn list_voices(
    state: State<'_, AppState>,
    engine: String,
) -> Result<Vec<VoiceInfo>, String> {
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
async fn update_tts_config(
    state: State<'_, AppState>,
    config: TtsConfig,
) -> Result<(), String> {
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
    state.clipboard_monitor_enabled.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

// ─── System Tray ──────────────────────────────────────────────────

fn create_system_tray() -> SystemTray {
    let show_hide = CustomMenuItem::new("show_hide".to_string(), "Show/Hide");
    let quick_input = CustomMenuItem::new("quick_input".to_string(), "Quick Input");
    let clipboard_monitor = CustomMenuItem::new("clipboard_monitor".to_string(), "Clipboard Monitor: OFF");
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
                        state.clipboard_monitor_enabled.store(new_state, Ordering::Relaxed);
                        
                        // Update tray menu item text
                        let text = if new_state { "Clipboard Monitor: ON" } else { "Clipboard Monitor: OFF" };
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
                        .transparent(false)
                        .always_on_top(false)
                        .center()
                        .build();
                    }
                }
                "quit" => {
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
    app.global_shortcut_manager().register("CmdOrCtrl+Shift+S", move || {
        if let Some(window) = app_handle.get_window("cat") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("toggle-input", ());
        }
    })?;

    let app_handle2 = app.clone();
    
    // Ctrl+Shift+R - Read clipboard content
    app.global_shortcut_manager().register("CmdOrCtrl+Shift+R", move || {
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
            match event.event() {
                WindowEvent::CloseRequested { api, .. } => {
                    // Only hide the main cat window; let other windows (settings) close normally
                    if event.window().label() == "cat" {
                        event.window().hide().unwrap();
                        api.prevent_close();
                    }
                }
                _ => {}
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
