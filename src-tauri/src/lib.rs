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
            delete_branch,
            rename_branch,
            create_branch,
            get_file_diff,
            merge_branch,
            fetch_remote,
            pull_branch,
            // Commit commands
            stage_files,
            unstage_files,
            stage_all,
            unstage_all,
            commit,
            revoke_latest_commit,
            batch_commit,
            generate_commit_message,
            review_code,
            // Stash commands
            get_stash_list,
            stash_save,
            stash_apply,
            stash_pop,
            stash_drop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
