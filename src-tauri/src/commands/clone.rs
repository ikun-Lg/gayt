use crate::error::Result;
use git2::build::RepoBuilder;
use git2::{Cred, FetchOptions, RemoteCallbacks, Progress};
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
struct CloneProgressPayload {
    total_objects: usize,
    indexed_objects: usize,
    received_objects: usize,
    local_objects: usize,
    total_deltas: usize,
    indexed_deltas: usize,
    received_bytes: usize,
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    url: String,
    destination: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<String, String> {
    clone_repository_impl(&app, &url, &destination, username, password).map_err(|e| e.to_string())
}

fn clone_repository_impl(
    app: &AppHandle,
    url: &str,
    destination: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<String> {
    let mut cb = RemoteCallbacks::new();

    // Clone the username/password for the callback
    let auth_username = username.clone();
    let auth_password = password.clone();
    
    // Handle credentials
    cb.credentials(move |url, username_from_url, allowed_types| {
        let default_username = username_from_url.unwrap_or("git");

        if let (Some(user), Some(pass)) = (&auth_username, &auth_password) {
            return Cred::userpass_plaintext(user, pass);
        }

        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
             // Try to use git-credential-helper if available, otherwise fail if no auth provided
             // We can't access repo config here easily as repo doesn't exist yet, 
             // but maybe we can use default config?
             // For now, let's rely on passed credentials or agent.
             // If we want to use helper, we might need Config::open_default()
             if let Ok(config) = git2::Config::open_default() {
                 Cred::credential_helper(&config, url, Some(default_username))
             } else {
                 Err(git2::Error::from_str("no authentication method available"))
             }
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            if let Ok(config) = git2::Config::open_default() {
                Cred::credential_helper(&config, url, Some(default_username))
            } else {
                 Err(git2::Error::from_str("no authentication method available"))
            }
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    // Handle progress
    let app_handle = app.clone();
    cb.transfer_progress(move |progress: Progress| {
        let payload = CloneProgressPayload {
            total_objects: progress.total_objects(),
            indexed_objects: progress.indexed_objects(),
            received_objects: progress.received_objects(),
            local_objects: progress.local_objects(),
            total_deltas: progress.total_deltas(),
            indexed_deltas: progress.indexed_deltas(),
            received_bytes: progress.received_bytes(),
        };
        // Emit event to frontend
        let _ = app_handle.emit("clone-progress", payload);
        true
    });

    let mut fo = FetchOptions::new();
    fo.remote_callbacks(cb);

    let mut builder = RepoBuilder::new();
    builder.fetch_options(fo);

    let _repo = builder.clone(url, Path::new(destination))?;

    Ok(destination.to_string())
}
