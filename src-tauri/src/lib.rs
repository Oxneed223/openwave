use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

const API_PORT: &str = "47821";
const SERVER_SOURCE: &str = include_str!("../../server.mjs");
const SPOTDL_HELPER_SOURCE: &str = include_str!("../../scripts/spotdl_search.py");

/// Keeps the local Node music service alive for as long as the app runs.
struct MusicApiProcess(Mutex<Option<Child>>);

fn api_dir() -> PathBuf {
    std::env::temp_dir().join("openwave-api")
}

fn write_resource(dir: &PathBuf, name: &str, content: &str) -> Option<PathBuf> {
    fs::create_dir_all(dir).ok()?;
    let path = dir.join(name);
    let needs_write = fs::read_to_string(&path)
        .map(|existing| existing != content)
        .unwrap_or(true);
    if needs_write {
        fs::write(&path, content).ok()?;
    }
    Some(path)
}

fn start_music_api() -> Option<Child> {
    let dir = api_dir();
    let server = write_resource(&dir, "server.mjs", SERVER_SOURCE)?;
    let helper = write_resource(&dir, "spotdl_search.py", SPOTDL_HELPER_SOURCE)?;

    let node = std::env::var("OPENWAVE_NODE").unwrap_or_else(|_| "node".to_string());
    let mut command = Command::new(node);
    command
        .arg(&server)
        .arg("--api-only")
        .arg("--port")
        .arg(API_PORT)
        .env("OPENWAVE_SPOTDL_HELPER", &helper)
        .env("OPENWAVE_PARENT_PID", std::process::id().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command.spawn().ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(MusicApiProcess(Mutex::new(None)))
        .setup(|app| {
            if let Some(child) = start_music_api() {
                *app.state::<MusicApiProcess>().0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running OpenWave");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = app_handle.state::<MusicApiProcess>().0.lock().unwrap().take()
            {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
