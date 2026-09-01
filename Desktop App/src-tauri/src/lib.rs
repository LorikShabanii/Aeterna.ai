#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // In dev, beforeDevCommand already runs `bun run dev` on :3000 — the
      // window's url (tauri.conf.json) points there directly. In a real
      // build there's no such process, so this spawns the bundled sidecar
      // (see build-sidecar.mjs) to serve the exact same :3000 the window
      // is configured to load. TanStack Start needs a running server for
      // its server functions (auth, vault, everything) — it can't run as
      // static files, which is what a plain frontendDist bundle would be.
      #[cfg(not(debug_assertions))]
      {
        use tauri_plugin_shell::ShellExt;
        let sidecar = app
          .shell()
          .sidecar("server")
          .expect("failed to create sidecar command");
        sidecar.spawn().expect("failed to spawn sidecar server");
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
