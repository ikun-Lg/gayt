mod domain;
mod commands;
mod error;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Repository commands
            scan_repositories,
            get_repo_status,
            get_branch_info,
            get_commit_history,
            get_local_branches,
            switch_branch,
            publish_branch,
            push_branch,
            get_git_username,
            // Commit commands
            stage_files,
            unstage_files,
            stage_all,
            unstage_all,
            commit,
            revoke_latest_commit,
            batch_commit,
            generate_commit_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
