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
            get_commit_history_paginated,
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
            get_merge_state,
            resolve_conflict,
            get_conflict_diff,
            abort_merge,
            complete_merge,
            write_conflict_file,
            get_rebase_state,
            start_interactive_rebase,
            continue_rebase,
            skip_rebase,
            abort_rebase,
            amend_rebase_commit,
            // Commit commands
            repo::search_commits,
            stage_files,
            unstage_files,
            stage_all,
            unstage_all,
            discard_files,
            apply_patch,
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
            // Clone command
            clone_repository,
            // Tag commands
            get_tags,
            create_tag,
            delete_tag,
            push_tag,
            delete_remote_tag,
            // Remote commands
            get_remotes,
            add_remote,
            remove_remote,
            rename_remote,
            set_remote_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
