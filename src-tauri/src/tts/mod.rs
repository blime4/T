pub mod cloud_tts;
pub mod engine;
pub mod manager;
pub mod piper_tts;
pub mod player;
pub mod system_tts;
pub mod types;

pub use manager::TtsManager;
pub use types::*;

/// Create a `tokio::process::Command` that hides the console window on Windows.
///
/// On Windows, spawning `powershell.exe`, `espeak.exe`, `piper.exe` etc. via
/// `Command::new()` will briefly flash a CMD window.  Setting the
/// `CREATE_NO_WINDOW` creation flag prevents this.
///
/// On non-Windows platforms this is a plain `Command::new()`.
pub(crate) fn silent_command<S: AsRef<std::ffi::OsStr>>(program: S) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut cmd = tokio::process::Command::new(program);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000
        cmd.creation_flags(0x08000000);
    }

    cmd
}
