use std::sync::Arc;
use std::sync::atomic::Ordering;
use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};
use tokio::sync::Mutex;

mod db;
mod idle;
mod tracker;
mod commands;

use tracker::TrackerState;

/// Check if the app was launched with --background flag (autostart scenario)
fn is_background_launch() -> bool {
    std::env::args().any(|a| a == "--background")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let start_hidden = is_background_launch();

    // Initialize the cached background-mode state from the real autostart status.
    // This runs once at startup so the close handler never needs to spawn a subprocess.
    commands::BACKGROUND_ENABLED.store(commands::autostart_is_enabled(), Ordering::Relaxed);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            // ─── Database & Tracker ───
            let app_data_dir = app.path().app_local_data_dir()
                .expect("Failed to resolve app local data directory");

            let pool = tauri::async_runtime::block_on(async {
                db::init_db(app_data_dir).await.expect("Failed to initialize SQLite database")
            });

            let tracker_state = Arc::new(Mutex::new(TrackerState::new(pool)));
            app.manage(tracker_state.clone());
            tracker::start_tracker_loop(tracker_state);

            // ─── System Tray ───
            let show_item = MenuItem::with_id(app, "show", "Show Aura", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Aura", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Aura Wellbeing")
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ─── Window Visibility ───
            if let Some(window) = app.get_webview_window("main") {
                if start_hidden {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept close: hide to tray instead of quitting
            // Reads cached AtomicBool — zero subprocess overhead, no freeze.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if commands::BACKGROUND_ENABLED.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_top_apps,
            commands::get_category_distribution,
            commands::get_hourly_timeline,
            commands::update_app_details,
            commands::create_goal,
            commands::get_goals,
            commands::start_focus_session,
            commands::end_focus_session,
            commands::get_focus_sessions,
            commands::get_heatmap_data,
            commands::get_autostart_enabled,
            commands::set_autostart_enabled,
            commands::export_data,
            commands::get_idle_monitoring,
            commands::set_idle_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
