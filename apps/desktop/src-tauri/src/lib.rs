use serde::Serialize;
use tauri::{Emitter, Listener};

#[derive(Serialize, Clone)]
pub struct FalkorStatus {
    pub running: bool,
    pub graph_exists: bool,
    pub node_count: i64,
}

/// Check if FalkorDB is running locally and if the Vex graph already has data.
/// Called from the frontend on every app launch (install or dev mode).
/// Returns FalkorStatus — frontend shows SetupWizard only when graph_exists = false.
#[tauri::command]
async fn falkor_check() -> FalkorStatus {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    // Try a raw TCP connection to FalkorDB (Redis wire protocol)
    let Ok(mut stream) = TcpStream::connect_timeout(
        &"127.0.0.1:6379".parse().unwrap(),
        Duration::from_secs(2),
    ) else {
        return FalkorStatus {
            running: false,
            graph_exists: false,
            node_count: 0,
        };
    };

    // GRAPH.QUERY Vex "MATCH (n) RETURN COUNT(n) AS c"
    let cmd = "*3\r\n$11\r\nGRAPH.QUERY\r\n$3\r\nVex\r\n$30\r\nMATCH (n) RETURN COUNT(n) AS c\r\n";
    if stream.write_all(cmd.as_bytes()).is_err() {
        return FalkorStatus {
            running: true,
            graph_exists: false,
            node_count: 0,
        };
    }

    let mut buf = vec![0u8; 512];
    let n = stream.read(&mut buf).unwrap_or(0);
    let response = String::from_utf8_lossy(&buf[..n]);

    // A missing graph returns "-ERR" or "-GRAPH: ..."
    let graph_exists = !response.contains("-ERR") && !response.contains("-GRAPH");

    let node_count = response
        .lines()
        .find(|l| l.starts_with(':'))
        .and_then(|l| l.trim_start_matches(':').parse::<i64>().ok())
        .unwrap_or(0);

    FalkorStatus {
        running: true,
        graph_exists,
        node_count,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.handle().deep_link().register("vex")?;
            }

            let handle = app.handle().clone();
            let handle_clone = handle.clone();
            handle.listen("deep-link://new-url", move |event| {
                let url = event.payload();
                log::info!("Received deep link: {}", url);

                if url.starts_with("vex://auth/callback") {
                    if let Ok(parsed_url) = tauri::Url::parse(url) {
                        for (key, value) in parsed_url.query_pairs() {
                            if key == "token" {
                                log::info!("OAuth callback received with token");
                                let _ = handle_clone.emit("oauth-callback", value.to_string());
                                break;
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![falkor_check])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
