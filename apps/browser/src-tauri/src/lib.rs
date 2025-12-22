use tauri::{Listener, Emitter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Register deep link handler for OAuth callbacks
      #[cfg(any(windows, target_os = "linux"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.handle().deep_link().register("vex")?;
      }

      // Listen for deep link events (OAuth callbacks)
      let handle = app.handle().clone();
      handle.listen("deep-link://new-url", move |event| {
        // Event payload is a string
        let url = event.payload();
        log::info!("Received deep link: {}", url);
        
        // Handle OAuth callback: vex://auth/callback?token=...
        if url.starts_with("vex://auth/callback") {
          // Extract token from URL and emit to frontend
          if let Ok(parsed_url) = tauri::Url::parse(url) {
            for (key, value) in parsed_url.query_pairs() {
              if key == "token" {
                log::info!("OAuth callback received with token");
                // Emit event to frontend with token
                let _ = handle.emit("oauth-callback", value.to_string());
                break;
              }
            }
          }
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
