use crate::domain::{RepositoryInfo, RepoStatus, StatusItem, BranchInfo, CommitInfo, LocalBranch};
use crate::error::{AppError, Result};
use git2::{Repository, StatusOptions};
use ignore::WalkBuilder;
use std::path::Path;
use rayon::prelude::*;

/// Scan a directory recursively for Git repositories
#[tauri::command]
pub async fn scan_repositories(root_path: String) -> std::result::Result<Vec<RepositoryInfo>, String> {
    scan_repositories_impl(&root_path).map_err(|e| e.to_string())
}

fn scan_repositories_impl(root_path: &str) -> Result<Vec<RepositoryInfo>> {
    let root = Path::new(root_path);

    if !root.exists() {
        return Err(AppError::RepoNotFound(root_path.to_string()));
    }

    let mut git_dirs = Vec::new();

    // Use ignore crate to walk the directory
    let walk = WalkBuilder::new(root)
        .hidden(false)
        .ignore(false)
        .git_ignore(false)
        .build();

    for entry in walk {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.join(".git").is_dir() {
                git_dirs.push(path.to_path_buf());
            }
        }
    }

    // Process repositories in parallel
    let repos: Result<Vec<_>> = git_dirs
        .par_iter()
        .map(|path| get_repository_info(path))
        .collect();

    // Sort by name
    let mut repos = repos?;
    repos.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(repos)
}

/// Get info for a single repository
fn get_repository_info(path: &Path) -> Result<RepositoryInfo> {
    let repo = Repository::open(path)?;
    let head = repo.head();

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let branch = match &head {
        Ok(head) => head
            .shorthand()
            .map(|s| s.to_string()),
        Err(_) => None,
    };

    let status = get_repo_status_impl(&repo)?;

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo)?;

    Ok(RepositoryInfo {
        path: path.to_string_lossy().to_string(),
        name,
        branch,
        has_changes: status.has_changes(),
        staged_count: status.staged.len(),
        unstaged_count: status.unstaged.len(),
        untracked_count: status.untracked.len(),
        ahead,
        behind,
    })
}

/// Get ahead/behind counts for the current branch
fn get_ahead_behind(repo: &Repository) -> Result<(usize, usize)> {
    let mut ahead = 0;
    let mut behind = 0;

    let head = repo.head().ok();
    let head_oid = head.as_ref().and_then(|h| h.target());
    let head_commit = head.as_ref().and_then(|h| h.peel_to_commit().ok());
    let branch_name = head.as_ref().and_then(|h| h.shorthand().map(|s| s.to_string()));

    if let (Some(head_oid), Some(_), Some(branch_name)) = (head_oid, head_commit, branch_name) {
        if let Ok(branch_obj) = repo.find_branch(&branch_name, git2::BranchType::Local) {
            if let Ok(upstream) = branch_obj.upstream() {
                if let Ok(upstream_commit) = upstream.into_reference().peel_to_commit() {
                    if let Ok((a, b)) = repo.graph_ahead_behind(head_oid, upstream_commit.id()) {
                        ahead = a;
                        behind = b;
                    }
                }
            }
        }
    }

    Ok((ahead, behind))
}

/// Get detailed status for a specific repository
#[tauri::command]
pub async fn get_repo_status(path: String) -> std::result::Result<RepoStatus, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_repo_status_impl(&repo).map_err(|e| e.to_string())
}

fn get_repo_status_impl(repo: &Repository) -> Result<RepoStatus> {
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.recurse_untracked_dirs(true);
    status_opts.recurse_ignored_dirs(false);

    let statuses = repo.statuses(Some(&mut status_opts))?;

    let mut repo_status = RepoStatus::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        let item = StatusItem {
            path: path.clone(),
            status: status.into(),
            old_path: None,
        };

        // Categorize the file
        if status.is_index_deleted()
            || status.is_index_modified()
            || status.is_index_renamed()
            || status.is_index_new()
            || status.is_index_typechange()
        {
            repo_status.staged.push(item.clone());
        }

        if status.is_wt_deleted()
            || status.is_wt_modified()
            || status.is_wt_renamed()
            || status.is_wt_typechange()
        {
            repo_status.unstaged.push(item.clone());
        }

        if status.is_wt_new() {
            repo_status.untracked.push(item.clone());
        }

        if status.is_conflicted() {
            repo_status.conflicted.push(item);
        }
    }

    Ok(repo_status)
}

/// Get branch info for a repository
#[tauri::command]
pub async fn get_branch_info(path: String) -> std::result::Result<BranchInfo, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_branch_info_impl(&repo).map_err(|e| e.to_string())
}

fn get_branch_info_impl(repo: &Repository) -> Result<BranchInfo> {
    let head = repo.head()?;
    let current = head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string();

    let (ahead, behind) = get_ahead_behind(repo)?;

    // Get upstream name and check if published
    // A branch is considered published if:
    // 1. It has an upstream configured
    // 2. The upstream branch exists on the remote
    let (upstream, is_published) = if let Ok(branch_name) = head.shorthand().ok_or(AppError::InvalidInput("No branch name".to_string())) {
        if let Ok(branch_obj) = repo.find_branch(branch_name, git2::BranchType::Local) {
            if let Ok(upstream_branch) = branch_obj.upstream() {
                let name = upstream_branch.name()?.map(|s| s.to_string());

                // Verify that the remote branch actually exists
                // by checking if we can resolve it to a commit
                let remote_exists = upstream_branch.into_reference().peel_to_commit().is_ok();

                (name, remote_exists)
            } else {
                (None, false)
            }
        } else {
            (None, false)
        }
    } else {
        (None, false)
    };

    Ok(BranchInfo {
        current,
        ahead,
        behind,
        upstream,
        is_published,
    })
}

/// Get commit history for a repository
#[tauri::command]
pub async fn get_commit_history(path: String, limit: usize) -> std::result::Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_commit_history_impl(&repo, limit).map_err(|e| e.to_string())
}

fn get_commit_history_impl(repo: &Repository, limit: usize) -> Result<Vec<CommitInfo>> {
    let head = repo.head()?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push(head.target().ok_or(AppError::InvalidInput("No head commit".to_string()))?)?;

    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        let timestamp = commit.time().seconds();
        let author = commit.author().name().unwrap_or("Unknown").to_string();
        let message = commit.message().unwrap_or("").to_string();
        let short_id = format!("{:.7}", oid);

        commits.push(CommitInfo {
            id: oid.to_string(),
            short_id,
            message,
            author,
            timestamp,
        });
    }

    Ok(commits)
}

/// Get local branches for a repository
#[tauri::command]
pub async fn get_local_branches(path: String) -> std::result::Result<Vec<LocalBranch>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_local_branches_impl(&repo).map_err(|e| e.to_string())
}

fn get_local_branches_impl(repo: &Repository) -> Result<Vec<LocalBranch>> {
    let mut branches = Vec::new();
    let head = repo.head();

    // Get current branch name
    let head_name = head
        .as_ref()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    for branch in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("unknown").to_string();
        let is_head = head_name.as_ref() == Some(&name);

        let upstream = if let Ok(upstream_branch) = branch.upstream() {
            upstream_branch.name().ok().flatten().map(|s| s.to_string())
        } else {
            None
        };

        branches.push(LocalBranch {
            name,
            is_head,
            upstream,
        });
    }

    // Sort: current branch first, then alphabetically
    branches.sort_by(|a, b| {
        if a.is_head != b.is_head {
            b.is_head.cmp(&a.is_head)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(branches)
}

/// Switch to a branch
#[tauri::command]
pub async fn switch_branch(path: String, branch_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    switch_branch_impl(&repo, &branch_name).map_err(|e| e.to_string())
}

fn switch_branch_impl(repo: &Repository, branch_name: &str) -> Result<()> {
    let obj = repo.revparse_single(branch_name)?;
    let tree = obj.peel_to_tree()?;
    repo.checkout_tree(&tree.as_object(), None)?;
    repo.set_head(&format!("refs/heads/{}", branch_name))?;
    Ok(())
}

/// Publish current branch (set upstream)
#[tauri::command]
pub async fn publish_branch(
    path: String,
    branch_name: String,
    remote: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    publish_branch_impl(&repo, &branch_name, &remote, username, password).map_err(|e| e.to_string())
}

/// Get the default username for git operations from config
#[tauri::command]
pub async fn get_git_username(path: String) -> std::result::Result<Option<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    // First try to get username from remote URL
    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            // Parse URL to extract username
            // Format: https://username@github.com/repo.git or https://github.com/username/repo.git
            if let Some(parsed) = extract_username_from_url(url) {
                return Ok(Some(parsed));
            }
        }
    }

    // Fall back to user.name config
    let config = repo.config().map_err(|e| e.to_string())?;

    // Try local config first
    if let Ok(name) = config.get_string("user.name") {
        return Ok(Some(name));
    }

    // Try global config via snapshot
    if let Ok(global_config) = git2::Config::open_default() {
        if let Ok(name) = global_config.get_string("user.name") {
            return Ok(Some(name));
        }
    }

    Ok(None)
}

fn extract_username_from_url(url: &str) -> Option<String> {
    // Try to parse username from HTTPS URL with auth
    // https://username@github.com/repo.git
    if url.starts_with("https://") {
        let rest = &url[8..];
        if let Some(at_pos) = rest.find('@') {
            let auth_part = &rest[..at_pos];
            // Split by ':' in case of password: username:password@github.com
            if let Some(colon_pos) = auth_part.find(':') {
                Some(auth_part[..colon_pos].to_string())
            } else {
                Some(auth_part.to_string())
            }
        } else {
            // Try to extract from path: https://github.com/username/repo.git
            let after_slash = rest.split('/').nth(1)?;
            Some(after_slash.to_string())
        }
    } else if url.starts_with("git@") {
        // SSH URL: git@github.com:username/repo.git
        None // SSH uses different auth
    } else {
        None
    }
}

fn publish_branch_impl(
    repo: &Repository,
    branch_name: &str,
    remote: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    // Find the remote
    let mut remote_obj = repo.find_remote(remote)
        .map_err(|_| AppError::InvalidInput(format!("Remote '{}' not found", remote)))?;

    // Prepare the push refspec
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    // Get repository config for credential helper
    let config = repo.config()?;

    // Clone the username/password for the callback
    let auth_username = username.clone();
    let auth_password = password.clone();

    // Set up remote callbacks for authentication
    let mut callbacks = git2::RemoteCallbacks::new();

    // Handle credentials for SSH/HTTPS
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        // Get username from URL or default to "git"
        let default_username = username_from_url.unwrap_or("git");

        // If username and password are provided, use them
        if let (Some(user), Some(pass)) = (&auth_username, &auth_password) {
            return git2::Cred::userpass_plaintext(user, pass);
        }

        // Try different authentication methods based on what's allowed
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            // Try SSH agent first for SSH URLs
            git2::Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            // For HTTPS, try to use git-credential-helper
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            // Try default credential helper
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    // Configure push options
    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    // Perform the push
    remote_obj.push(&[&refspec], Some(&mut push_options))?;

    // After successful push, set upstream
    let mut branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
    branch.set_upstream(Some(&format!("{}/{}", remote, branch_name)))?;

    Ok(())
}

