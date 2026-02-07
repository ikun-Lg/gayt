use crate::domain::{RepositoryInfo, RepoStatus, StatusItem, BranchInfo, CommitInfo, LocalBranch, TagInfo, RemoteInfo, ConflictInfo, MergeState};
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
    // - is_published: 分支是否已设置 upstream（即已发布过）
    // - need_push: 是否有待推送的提交（ahead > 0）
    let (upstream, is_published) = if let Ok(branch_name) = head.shorthand().ok_or(AppError::InvalidInput("No branch name".to_string())) {
        if let Ok(branch_obj) = repo.find_branch(branch_name, git2::BranchType::Local) {
            if let Ok(upstream_branch) = branch_obj.upstream() {
                // Get name before consuming the branch
                let name = upstream_branch.name()?.map(|s| s.to_string());

                // 分支有 upstream 配置，且 upstream 分支名包含当前分支名（忽略大小写），才算已发布
                let is_published = name.as_ref().map_or(false, |n| {
                    let n = n.to_lowercase();
                    let b = branch_name.to_lowercase();
                    n == b || n.ends_with(&format!("/{}", b))
                });
                (name, is_published)
            } else {
                (None, false)
            }
        } else {
            (None, false)
        }
    } else {
        (None, false)
    };

    // need_push: 有 ahead 的提交需要推送
    let need_push = ahead > 0;

    Ok(BranchInfo {
        current,
        ahead,
        behind,
        upstream,
        is_published,
        need_push,
    })
}

/// Get commit history for a repository
#[tauri::command]
pub async fn get_commit_history(path: String, limit: usize) -> std::result::Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_commit_history_impl(&repo, limit).map_err(|e| e.to_string())
}

fn get_commit_history_impl(repo: &Repository, limit: usize) -> Result<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;
    
    // Push HEAD
    if let Ok(head) = repo.head() {
        if let Ok(target) = head.target().ok_or(AppError::InvalidInput("No head commit".to_string())) {
            revwalk.push(target)?;
        }
    }

    // Push all local branches to graph
    // This allows us to see commits from other branches
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch in branches {
            if let Ok((branch, _)) = branch {
                if let Some(target) = branch.get().target() {
                    revwalk.push(target)?;
                }
            }
        }
    }

    let mut commits = Vec::new();
    
    // Get all references to map commit IDs to branch names/tags
    let mut ref_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    if let Ok(references) = repo.references() {
        for reference in references {
            if let Ok(reference) = reference {
                if let Some(target) = reference.target() {
                    let name = reference.shorthand().unwrap_or("").to_string();
                    if !name.is_empty() && !name.starts_with("origin/") { // Filter remote refs for now to reduce clutter? Or keep them?
                         ref_map.entry(target.to_string()).or_default().push(name);
                    }
                }
            }
        }
    }

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
        
        // Get parents
        let parents = commit.parent_ids().map(|id| id.to_string()).collect();
        
        // Get refs
        let refs = ref_map.get(&oid.to_string()).cloned().unwrap_or_default();

        commits.push(CommitInfo {
            id: oid.to_string(),
            short_id,
            message,
            author,
            timestamp,
            parents,
            refs,
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

/// Delete a branch
#[tauri::command]
pub async fn delete_branch(path: String, branch_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branch = repo.find_branch(&branch_name, git2::BranchType::Local).map_err(|e| e.to_string())?;
    branch.delete().map_err(|e| e.to_string())?;
    Ok(())
}

/// Rename a branch
#[tauri::command]
pub async fn rename_branch(path: String, old_name: String, new_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branch = repo.find_branch(&old_name, git2::BranchType::Local).map_err(|e| e.to_string())?;
    branch.rename(&new_name, false).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a new branch from a base branch
#[tauri::command]
pub async fn create_branch(path: String, new_branch_name: String, base_branch_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    
    // Find the commit of the base branch
    let base_branch = repo.find_branch(&base_branch_name, git2::BranchType::Local).map_err(|e| e.to_string())?;
    let commit = base_branch.get().peel_to_commit().map_err(|e| e.to_string())?;
    
    // Create the new branch
    repo.branch(&new_branch_name, &commit, false).map_err(|e| e.to_string())?;
    
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

    // Clone credentials for both push and fetch callbacks
    let auth_username_push = username.clone();
    let auth_password_push = password.clone();
    let auth_username_fetch = username.clone();
    let auth_password_fetch = password.clone();

    // Set up remote callbacks for authentication
    let mut callbacks = git2::RemoteCallbacks::new();

    // Handle credentials for SSH/HTTPS
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        // Get username from URL or default to "git"
        let default_username = username_from_url.unwrap_or("git");

        // If username and password are provided, use them
        if let (Some(user), Some(pass)) = (&auth_username_push, &auth_password_push) {
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

    // Fetch to update remote-tracking branch instead of manually updating it
    // This ensures the remote-tracking branch reflects the actual remote state
    let config_for_fetch = repo.config()?;
    let mut fetch_callbacks = git2::RemoteCallbacks::new();
    fetch_callbacks.credentials(move |url, username_from_url, allowed_types| {
        let default_username = username_from_url.unwrap_or("git");
        if let (Some(user), Some(pass)) = (&auth_username_fetch, &auth_password_fetch) {
            return git2::Cred::userpass_plaintext(user, pass);
        }
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            git2::Cred::credential_helper(&config_for_fetch, url, Some(default_username))
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            git2::Cred::credential_helper(&config_for_fetch, url, Some(default_username))
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(fetch_callbacks);

    // Fetch the specific branch to update the remote-tracking reference
    let fetch_refspec = format!("{}:{}", branch_name, branch_name);
    if let Err(e) = remote_obj.fetch(&[&fetch_refspec], Some(&mut fetch_options), None) {
        // If fetch fails (e.g., remote doesn't allow anonymous fetch), log but don't fail the push
        eprintln!("Warning: Failed to fetch after push: {}", e);
    }

    Ok(())
}

/// Push commits to remote (for already published branches)
#[tauri::command]
pub async fn push_branch(
    path: String,
    branch_name: String,
    remote: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    push_branch_impl(&repo, &branch_name, &remote, username, password).map_err(|e| e.to_string())
}

fn push_branch_impl(
    repo: &Repository,
    branch_name: &str,
    remote: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    // Find the remote
    let mut remote_obj = repo.find_remote(remote)
        .map_err(|_| AppError::InvalidInput(format!("Remote '{}' not found", remote)))?;

    // Prepare the push refspec (push to existing remote branch)
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    // Get repository config for credential helper
    let config = repo.config()?;

    // Clone credentials for both push and fetch callbacks
    let auth_username_push = username.clone();
    let auth_password_push = password.clone();
    let auth_username_fetch = username.clone();
    let auth_password_fetch = password.clone();

    // Set up remote callbacks for authentication
    let mut callbacks = git2::RemoteCallbacks::new();

    // Handle credentials for SSH/HTTPS
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        // Get username from URL or default to "git"
        let default_username = username_from_url.unwrap_or("git");

        // If username and password are provided, use them
        if let (Some(user), Some(pass)) = (&auth_username_push, &auth_password_push) {
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

    // Fetch to update remote-tracking branch instead of manually updating it
    // This ensures the remote-tracking branch reflects the actual remote state
    let config_for_fetch = repo.config()?;
    let mut fetch_callbacks = git2::RemoteCallbacks::new();
    fetch_callbacks.credentials(move |url, username_from_url, allowed_types| {
        let default_username = username_from_url.unwrap_or("git");
        if let (Some(user), Some(pass)) = (&auth_username_fetch, &auth_password_fetch) {
            return git2::Cred::userpass_plaintext(user, pass);
        }
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            git2::Cred::credential_helper(&config_for_fetch, url, Some(default_username))
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            git2::Cred::credential_helper(&config_for_fetch, url, Some(default_username))
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(fetch_callbacks);

    // Fetch the specific branch to update the remote-tracking reference
    let fetch_refspec = format!("{}:{}", branch_name, branch_name);
    if let Err(e) = remote_obj.fetch(&[&fetch_refspec], Some(&mut fetch_options), None) {
        // If fetch fails (e.g., remote doesn't allow anonymous fetch), log but don't fail the push
        eprintln!("Warning: Failed to fetch after push: {}", e);
    }

    Ok(())
}

/// Get diff for a specific file
#[tauri::command]
pub async fn get_file_diff(path: String, file_path: String) -> std::result::Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_file_diff_impl(&repo, &file_path).map_err(|e| e.to_string())
}

fn get_file_diff_impl(repo: &Repository, file_path: &str) -> Result<String> {
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(file_path);

    let mut diff_content = String::new();

    // 1. Check if file is untracked
    let status = repo.status_file(Path::new(file_path))?;
    if status.is_wt_new() {
        // For untracked files, we show the whole content as additions
        let content = std::fs::read_to_string(repo.workdir().unwrap().join(file_path))?;
        for line in content.lines() {
            diff_content.push_str(&format!("+{}\n", line));
        }
        return Ok(diff_content);
    }

    // 2. Get staged changes (Index vs HEAD)
    let head = repo.head().ok();
    let head_tree = head
        .as_ref()
        .and_then(|h| h.peel_to_tree().ok());
    
    let staged_diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))?;
    
    // 3. Get unstaged changes (Workdir vs Index)
    let unstaged_diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;

    // Format the diffs
    let mut format_diff = |diff: git2::Diff| -> Result<()> {
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            let content = std::str::from_utf8(line.content()).unwrap_or("");
            match origin {
                '+' | '-' | ' ' => {
                    diff_content.push(origin);
                    diff_content.push_str(content);
                }
                'H' => {
                    diff_content.push_str(content);
                }
                _ => {}
            }
            true
        })?;
        Ok(())
    };

    format_diff(staged_diff)?;
    format_diff(unstaged_diff)?;

    Ok(diff_content)
}

/// Merge a branch into the current branch
#[tauri::command]
pub async fn merge_branch(path: String, branch_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    merge_branch_impl(&repo, &branch_name).map_err(|e| e.to_string())
}

fn merge_branch_impl(repo: &Repository, branch_name: &str) -> Result<()> {
    let annotated_commit = repo.find_annotated_commit(
        repo.revparse_single(branch_name)?.id()
    )?;

    let (analysis, _) = repo.merge_analysis(&[&annotated_commit])?;

    if analysis.is_up_to_date() {
        return Ok(());
    } else if analysis.is_fast_forward() {
        // Fast-forward merge
        let mut reference = repo.head()?;
        let name = match reference.name() {
            Some(n) => n.to_string(),
            None => return Err(AppError::InvalidInput("HEAD is not a reference".to_string())),
        };
        
        let target_id = annotated_commit.id();
        reference.set_target(target_id, "Fast-forward merge")?;
        
        // Checkout the new head
        let obj = repo.find_object(target_id, None)?;
        repo.checkout_tree(&obj, None)?;
        repo.set_head(&name)?;
        
    } else if analysis.is_normal() {
        // Merge commit
        let head_commit = repo.head()?.peel_to_commit()?;
        let merge_commit = repo.find_commit(annotated_commit.id())?;
        
        repo.merge(&[&annotated_commit], None, None)?;
        let mut index = repo.index()?;
        
        if index.has_conflicts() {
            return Err(AppError::MergeConflict);
        }
        
        let tree_id = index.write_tree_to(repo)?;
        let tree = repo.find_tree(tree_id)?;
        
        let signature = repo.signature()?;
        let message = format!("Merge branch '{}'", branch_name);
        
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[&head_commit, &merge_commit],
        )?;
        
        // Cleanup merge state
        repo.cleanup_state()?;
        
        // Checkout the new state
        repo.checkout_index(None, None)?;
    }

    Ok(())
}

/// Fetch from remote
#[tauri::command]
pub async fn fetch_remote(
    path: String,
    remote: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    fetch_remote_impl(&repo, &remote, username, password).map_err(|e| e.to_string())
}

fn fetch_remote_impl(
    repo: &Repository,
    remote: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    // Find the remote
    let mut remote_obj = repo.find_remote(remote)
        .map_err(|_| AppError::InvalidInput(format!("Remote '{}' not found", remote)))?;

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

    // Configure fetch options
    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    // Configure fetch options to handle tag conflicts properly
    // PRUNE: Remove remote-tracking references that no longer exist on the remote
    // UPDATE_FETCHHEAD: Update FETCH_HEAD to the latest fetched commit
    fetch_options.prune(git2::FetchPrune::On);
    fetch_options.update_fetchhead(true);

    // Tags: Fetch all tags and handle conflicts by force updating
    // This is similar to git's --tags --force behavior
    fetch_options.download_tags(git2::AutotagOption::All);

    // Perform the fetch
    // Default refspec is usually configured for the remote, so we can pass empty refspec list to use default
    remote_obj.fetch(&[] as &[&str], Some(&mut fetch_options), None)?;

    Ok(())
}

/// Pull from remote (fetch + merge)
#[tauri::command]
pub async fn pull_branch(
    path: String,
    remote: String,
    branch: String,
    use_rebase: bool,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    pull_branch_impl(&repo, &remote, &branch, use_rebase, username, password).map_err(|e| e.to_string())
}

fn pull_branch_impl(
    repo: &Repository,
    remote: &str,
    branch: &str,
    use_rebase: bool,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    // 1. Fetch first
    fetch_remote_impl(repo, remote, username, password)?;

    // 2. Prepare for merge/rebase
    let remote_branch_name = format!("{}/{}", remote, branch);
    let fetch_head_obj = repo.revparse_single(&remote_branch_name)
        .map_err(|_| AppError::InvalidInput(format!("Remote branch '{}' not found", remote_branch_name)))?;
    
    let fetch_head_commit = fetch_head_obj.peel_to_commit()?;
    let annotated_commit = repo.find_annotated_commit(fetch_head_commit.id())?;

    // 3. Merge analysis
    let (analysis, _) = repo.merge_analysis(&[&annotated_commit])?;

    if analysis.is_up_to_date() {
        return Ok(());
    } else if analysis.is_fast_forward() {
        // Fast-forward merge
        let mut reference = repo.head()?;
        let name = match reference.name() {
            Some(n) => n.to_string(),
            None => return Err(AppError::InvalidInput("HEAD is not a reference".to_string())),
        };
        
        let target_id = annotated_commit.id();
        reference.set_target(target_id, "Fast-forward pull")?;
        
        // Checkout the new head
        let obj = repo.find_object(target_id, None)?;
        repo.checkout_tree(&obj, None)?;
        repo.set_head(&name)?;
        
    } else if analysis.is_normal() {
        if use_rebase {
             // For now, we only support merge. Rebase in libgit2 is complex.
             return Err(AppError::InvalidInput("Rebase strategy not yet fully supported in this backend. Please use Merge strategy.".to_string()));
        }

        // Merge commit
        let head_commit = repo.head()?.peel_to_commit()?;
        let merge_commit = repo.find_commit(annotated_commit.id())?;
        
        repo.merge(&[&annotated_commit], None, None)?;
        let mut index = repo.index()?;
        
        if index.has_conflicts() {
            return Err(AppError::MergeConflict);
        }
        
        let tree_id = index.write_tree_to(repo)?;
        let tree = repo.find_tree(tree_id)?;
        
        let signature = repo.signature()?;
        let message = format!("Merge remote-tracking branch '{}'", remote_branch_name);
        
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[&head_commit, &merge_commit],
        )?;
        
        // Cleanup merge state
        repo.cleanup_state()?;
        
        // Checkout the new state
        repo.checkout_index(None, None)?;
    }

    Ok(())
}

/// Get all tags for a repository
#[tauri::command]
pub async fn get_tags(path: String) -> std::result::Result<Vec<TagInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_tags_impl(&repo).map_err(|e| e.to_string())
}

fn get_tags_impl(repo: &Repository) -> Result<Vec<TagInfo>> {
    let tag_names = repo.tag_names(None)?;
    let mut tags = Vec::new();

    for name in tag_names.iter().flatten() {
        if let Ok(obj) = repo.revparse_single(name) {
            let mut message: Option<String> = None;
            let mut tagger: Option<String> = None;
            let mut date: Option<i64> = None;

            // Check if it's an annotated tag
            if let Some(tag) = obj.as_tag() {
                message = tag.message().map(|s| s.to_string());
                if let Some(sig) = tag.tagger() {
                    tagger = sig.name().map(|s| s.to_string());
                    date = Some(sig.when().seconds());
                }
            } else if let Ok(_commit) = obj.peel_to_commit() {
                // Lightweight tag points directly to commit
            }

            // Target commit SHA
            let target = obj.peel_to_commit()?.id().to_string();

            tags.push(TagInfo {
                name: name.to_string(),
                message,
                target,
                tagger,
                date,
            });
        }
    }
    
    // Sort tags by date (descending) or name
    tags.sort_by(|a, b| {
        // Prefer date if available
        match (a.date, b.date) {
            (Some(da), Some(db)) => db.cmp(&da), // Descending
            _ => b.name.cmp(&a.name), // Fallback to name
        }
    });

    Ok(tags)
}

/// Create a new tag
#[tauri::command]
pub async fn create_tag(
    path: String,
    name: String,
    message: Option<String>,
    target: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    create_tag_impl(&repo, &name, message, target).map_err(|e| e.to_string())
}

fn create_tag_impl(repo: &Repository, name: &str, message: Option<String>, target: Option<String>) -> Result<()> {
    // Get the target object
    let obj = if let Some(oid_str) = target {
        repo.find_object(git2::Oid::from_str(&oid_str)?, None)?
    } else {
        repo.head()?.peel(git2::ObjectType::Any)?
    };

    if let Some(msg) = message {
        // Annotated tag
        let signature = repo.signature()?;
        repo.tag(name, &obj, &signature, &msg, false)?;
    } else {
        // Lightweight tag
        repo.tag_lightweight(name, &obj, false)?;
    }

    Ok(())
}

/// Delete a tag
#[tauri::command]
pub async fn delete_tag(path: String, name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    repo.tag_delete(&name).map_err(|e| e.to_string())?;
    Ok(())
}

/// Push a tag to remote
#[tauri::command]
pub async fn push_tag(
    path: String,
    tag_name: String,
    remote: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    push_tag_impl(&repo, &tag_name, &remote, username, password).map_err(|e| e.to_string())
}

fn push_tag_impl(
    repo: &Repository,
    tag_name: &str,
    remote: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    let mut remote_obj = repo.find_remote(remote)
        .map_err(|_| AppError::InvalidInput(format!("Remote '{}' not found", remote)))?;

    // Refspec for pushing a tag
    let refspec = format!("refs/tags/{}:refs/tags/{}", tag_name, tag_name);

    let config = repo.config()?;
    let auth_username = username.clone();
    let auth_password = password.clone();

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        let default_username = username_from_url.unwrap_or("git");
        if let (Some(user), Some(pass)) = (&auth_username, &auth_password) {
            return git2::Cred::userpass_plaintext(user, pass);
        }
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote_obj.push(&[&refspec], Some(&mut push_options))?;

    Ok(())
}

/// Delete a remote tag
#[tauri::command]
pub async fn delete_remote_tag(
    path: String,
    tag_name: String,
    remote: String,
    username: Option<String>,
    password: Option<String>,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    delete_remote_tag_impl(&repo, &tag_name, &remote, username, password).map_err(|e| e.to_string())
}

fn delete_remote_tag_impl(
    repo: &Repository,
    tag_name: &str,
    remote: &str,
    username: Option<String>,
    password: Option<String>,
) -> Result<()> {
    let mut remote_obj = repo.find_remote(remote)
        .map_err(|_| AppError::InvalidInput(format!("Remote '{}' not found", remote)))?;

    // Refspec for deleting a remote ref
    let refspec = format!(":refs/tags/{}", tag_name);

    let config = repo.config()?;
    let auth_username = username.clone();
    let auth_password = password.clone();

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        let default_username = username_from_url.unwrap_or("git");
        if let (Some(user), Some(pass)) = (&auth_username, &auth_password) {
            return git2::Cred::userpass_plaintext(user, pass);
        }
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(default_username)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else if allowed_types.contains(git2::CredentialType::DEFAULT) {
            git2::Cred::credential_helper(&config, url, Some(default_username))
        } else {
            Err(git2::Error::from_str("no authentication method available"))
        }
    });

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote_obj.push(&[&refspec], Some(&mut push_options))?;

    Ok(())
}

/// Get list of remotes for a repository
#[tauri::command]
pub async fn get_remotes(path: String) -> std::result::Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_remotes_impl(&repo).map_err(|e| e.to_string())
}

fn get_remotes_impl(repo: &Repository) -> Result<Vec<RemoteInfo>> {
    let remotes = repo.remotes()?;
    let mut remote_infos = Vec::new();

    for remote_name in remotes.iter() {
        if let Some(name) = remote_name {
            if let Ok(remote) = repo.find_remote(name) {
                remote_infos.push(RemoteInfo {
                    name: name.to_string(),
                    url: remote.url().map(|s| s.to_string()),
                    push_url: remote.pushurl().map(|s| s.to_string()),
                });
            }
        }
    }

    Ok(remote_infos)
}

/// Add a new remote
#[tauri::command]
pub async fn add_remote(path: String, name: String, url: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    repo.remote(&name, &url).map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a remote
#[tauri::command]
pub async fn remove_remote(path: String, name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    repo.remote_delete(&name).map_err(|e| e.to_string())?;
    Ok(())
}

/// Rename a remote
#[tauri::command]
pub async fn rename_remote(path: String, old_name: String, new_name: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    repo.remote_rename(&old_name, &new_name).map_err(|e| e.to_string())?;
    Ok(())
}

/// Set remote URL
#[tauri::command]
pub async fn set_remote_url(path: String, name: String, url: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    repo.remote_set_url(&name, &url).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get merge state and conflict information
#[tauri::command]
pub async fn get_merge_state(path: String) -> std::result::Result<MergeState, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_merge_state_impl(&repo).map_err(|e| e.to_string())
}

fn get_merge_state_impl(repo: &Repository) -> Result<MergeState> {
    let index = repo.index()?;
    let is_merge_in_progress = index.has_conflicts();

    let mut conflicted_files = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    if is_merge_in_progress {
        // Iterate through index entries to find conflicted files
        for entry in index.iter() {
            let path_bytes = &entry.path;
            let path = String::from_utf8_lossy(path_bytes).to_string();

            if path.is_empty() {
                continue;
            }

            // Skip if we've already processed this file
            if seen_paths.contains(&path) {
                continue;
            }

            // Check if this file has conflicts
            let has_conflict = index
                .iter()
                .any(|e| String::from_utf8_lossy(&e.path).to_string() == path);

            if has_conflict {
                seen_paths.insert(path.clone());

                // Read conflict content from the file
                let workdir = repo.workdir().ok_or(AppError::InvalidInput("No workdir".to_string()))?;
                let file_path = workdir.join(&path);

                let (current, incoming, ancestor, conflict_markers) = if file_path.exists() {
                    let content = std::fs::read_to_string(&file_path).unwrap_or_default();
                    parse_conflict_content(&content)
                } else {
                    (None, None, None, false)
                };

                conflicted_files.push(ConflictInfo {
                    path,
                    current,
                    incoming,
                    ancestor,
                    conflict_markers,
                });
            }
        }
    }

    Ok(MergeState {
        is_merge_in_progress,
        conflict_count: conflicted_files.len(),
        conflicted_files,
    })
}

/// Parse conflict markers from file content
fn parse_conflict_content(content: &str) -> (Option<String>, Option<String>, Option<String>, bool) {
    let mut current = None;
    let mut incoming = None;
    let mut ancestor = None;
    let has_markers = content.contains("<<<<<<<") || content.contains(">>>>>>>");

    // Simple conflict marker parsing
    let lines: Vec<&str> = content.lines().collect();
    let mut state = ConflictParseState::None;
    let mut current_buf = String::new();
    let mut incoming_buf = String::new();
    let ancestor_buf = String::new();

    for line in lines {
        if line.contains("<<<<<<<") {
            state = ConflictParseState::Current;
        } else if line.contains("=======") && !line.contains(">>>>>>>") {
            state = ConflictParseState::Incoming;
        } else if line.contains(">>>>>>>") {
            state = ConflictParseState::None;
        } else {
            match state {
                ConflictParseState::Current => {
                    current_buf.push_str(line);
                    current_buf.push('\n');
                }
                ConflictParseState::Incoming => {
                    incoming_buf.push_str(line);
                    incoming_buf.push('\n');
                }
                ConflictParseState::None => {}
            }
        }
    }

    if !current_buf.is_empty() {
        current = Some(current_buf.trim().to_string());
    }
    if !incoming_buf.is_empty() {
        incoming = Some(incoming_buf.trim().to_string());
    }
    if !ancestor_buf.is_empty() {
        ancestor = Some(ancestor_buf.trim().to_string());
    }

    (current, incoming, ancestor, has_markers)
}

#[derive(Debug, Clone, Copy)]
enum ConflictParseState {
    None,
    Current,
    Incoming,
}

/// Resolve a conflict file by accepting a specific version
#[tauri::command]
pub async fn resolve_conflict(
    path: String,
    file_path: String,
    version: String,
) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    resolve_conflict_impl(&repo, &file_path, &version).map_err(|e| e.to_string())
}

fn resolve_conflict_impl(repo: &Repository, file_path: &str, version: &str) -> Result<()> {
    let workdir = repo.workdir().ok_or(AppError::InvalidInput("No workdir".to_string()))?;

    // Use git checkout to accept different versions
    let checkout_arg = match version {
        "current" | "ours" => "--ours",
        "incoming" | "theirs" => "--theirs",
        "ancestor" | "base" => {
            // For ancestor, we need a different approach since git doesn't directly support --base
            return Err(AppError::InvalidInput(
                "Ancestor resolution not directly supported. Please use 'current' or 'incoming'.".to_string()
            ));
        }
        "manual" => {
            // User manually resolved, just add the file
            let mut index = repo.index()?;
            index.add_all(
                [file_path].iter(),
                git2::IndexAddOption::DEFAULT,
                None,
            )?;
            index.write()?;
            return Ok(());
        }
        _ => {
            return Err(AppError::InvalidInput(format!("Unknown version: {}", version)));
        }
    };

    // Use git command line tool for checkout
    let output = std::process::Command::new("git")
        .arg("checkout")
        .arg(checkout_arg)
        .arg("--")
        .arg(file_path)
        .current_dir(workdir)
        .output()?;

    if !output.status.success() {
        return Err(AppError::Git(git2::Error::from_str(&String::from_utf8_lossy(&output.stderr))));
    }

    // Stage the resolved file
    let mut index = repo.index()?;
    index.add_all(
        [file_path].iter(),
        git2::IndexAddOption::DEFAULT,
        None,
    )?;
    index.write()?;

    Ok(())
}

/// Get conflict diff for a specific file
#[tauri::command]
pub async fn get_conflict_diff(
    path: String,
    file_path: String,
) -> std::result::Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    get_conflict_diff_impl(&repo, &file_path).map_err(|e| e.to_string())
}

fn get_conflict_diff_impl(repo: &Repository, file_path: &str) -> Result<String> {
    let workdir = repo.workdir().ok_or(AppError::InvalidInput("No workdir".to_string()))?;
    let full_path = workdir.join(file_path);

    if !full_path.exists() {
        return Ok("File does not exist in working directory".to_string());
    }

    let content = std::fs::read_to_string(&full_path).unwrap_or_default();

    // Check if file has conflict markers
    if !content.contains("<<<<<<<") {
        return Ok("No conflict markers found in file".to_string());
    }

    // Return the raw content for display
    Ok(content)
}

/// Abort the current merge
#[tauri::command]
pub async fn abort_merge(path: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    abort_merge_impl(&repo).map_err(|e| e.to_string())
}

fn abort_merge_impl(repo: &Repository) -> Result<()> {
    // Check if merge is in progress
    let index = repo.index()?;
    if !index.has_conflicts() {
        return Err(AppError::InvalidInput("No merge in progress".to_string()));
    }

    // Cleanup merge state
    repo.cleanup_state()?;

    // Reset to HEAD
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    let tree = commit.tree()?;

    repo.checkout_tree(tree.as_object(), None)?;
    repo.set_head(head.name().ok_or(AppError::InvalidInput("No HEAD name".to_string()))?)?;

    Ok(())
}

/// Complete the merge after resolving conflicts
#[tauri::command]
pub async fn complete_merge(path: String, message: Option<String>) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    complete_merge_impl(&repo, message).map_err(|e| e.to_string())
}

fn complete_merge_impl(repo: &Repository, message: Option<String>) -> Result<()> {
    let mut index = repo.index()?;

    if index.has_conflicts() {
        return Err(AppError::InvalidInput("Cannot complete merge with unresolved conflicts".to_string()));
    }

    // Write the tree
    let tree_id = index.write_tree_to(repo)?;
    let tree = repo.find_tree(tree_id)?;

    // Get the merge message
    let merge_msg = if let Some(msg) = message {
        msg
    } else {
        // Try to get from .git/MERGE_MSG
        let git_dir = repo.path();
        let merge_msg_path = git_dir.join("MERGE_MSG");
        if merge_msg_path.exists() {
            std::fs::read_to_string(&merge_msg_path).unwrap_or_else(|_| "Merge commit".to_string())
        } else {
            "Merge commit".to_string()
        }
    };

    let signature = repo.signature()?;

    // Get HEAD commit
    let head_commit = repo.head()?.peel_to_commit()?;

    // Get MERGE_HEAD to find the other parent
    let git_dir = repo.path();
    let merge_head_path = git_dir.join("MERGE_HEAD");
    if !merge_head_path.exists() {
        return Err(AppError::InvalidInput("No merge in progress".to_string()));
    }

    let merge_head_content = std::fs::read_to_string(&merge_head_path)?;
    let merge_oid = git2::Oid::from_str(trim(&merge_head_content))?;
    let merge_commit = repo.find_commit(merge_oid)?;

    // Create the merge commit
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &merge_msg,
        &tree,
        &[&head_commit, &merge_commit],
    )?;

    // Cleanup merge state
    repo.cleanup_state()?;

    // Checkout the new state
    repo.checkout_index(None, None)?;

    Ok(())
}

fn trim(s: &str) -> &str {
    s.trim().trim_end_matches('\n')
}
