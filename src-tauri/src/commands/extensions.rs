use crate::domain::{SubmoduleInfo, SubtreeInfo, LfsStatus};
use git2::Repository;
use std::process::Command;

/// Get submodules for a repository
#[tauri::command]
pub async fn get_submodules(path: String) -> std::result::Result<Vec<SubmoduleInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut submodules = Vec::new();

    let sms = repo.submodules().map_err(|e| e.to_string())?;
    for sm in sms {
        let name = sm.name().unwrap_or("").to_string();
        let path = sm.path().to_string_lossy().to_string();
        let url = sm.url().unwrap_or("").to_string();
        let head_id = sm.head_id().map(|id| id.to_string());
        let index_id = sm.index_id().map(|id| id.to_string());
        
        // Get submodule status
        let status = match repo.submodule_status(&name, git2::SubmoduleIgnore::None) {
            Ok(s) => {
                if s.is_in_index() && s.is_in_config() && s.is_in_head() && s.is_in_wd() {
                    "in_sync".to_string()
                } else if s.is_wd_uninitialized() {
                    "uninitialized".to_string()
                } else {
                    "modified".to_string()
                }
            },
            Err(_) => "unknown".to_string(),
        };

        submodules.push(SubmoduleInfo {
            name,
            path,
            url,
            head_id,
            index_id,
            status,
        });
    }

    Ok(submodules)
}

/// Update and initialize submodules
#[tauri::command]
pub async fn update_submodule(path: String) -> std::result::Result<(), String> {
    let output = Command::new("git")
        .args(["submodule", "update", "--init", "--recursive"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Initialize submodules
#[tauri::command]
pub async fn init_submodule(path: String) -> std::result::Result<(), String> {
    let output = Command::new("git")
        .args(["submodule", "init"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Get Git LFS status
#[tauri::command]
pub async fn get_lfs_status(path: String) -> std::result::Result<LfsStatus, String> {
    // Check if git-lfs is installed by running 'git lfs version'
    let version_output = Command::new("git")
        .args(["lfs", "version"])
        .current_dir(&path)
        .output();

    let is_installed = version_output.is_ok() && version_output.unwrap().status.success();

    if !is_installed {
        return Ok(LfsStatus {
            is_installed: false,
            tracked_files: Vec::new(),
        });
    }

    // Get tracked files using 'git lfs track'
    let track_output = Command::new("git")
        .args(["lfs", "track"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    let mut tracked_files = Vec::new();
    if track_output.status.success() {
        let content = String::from_utf8_lossy(&track_output.stdout);
        for line in content.lines() {
            if line.contains("Listing tracked patterns") {
                continue;
            }
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            if !parts.is_empty() {
                tracked_files.push(parts[0].to_string());
            }
        }
    }

    Ok(LfsStatus {
        is_installed,
        tracked_files,
    })
}

/// Track a pattern with Git LFS
#[tauri::command]
pub async fn lfs_track(path: String, pattern: String) -> std::result::Result<(), String> {
    let output = Command::new("git")
        .args(["lfs", "track", &pattern])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Untrack a pattern with Git LFS
#[tauri::command]
pub async fn lfs_untrack(path: String, pattern: String) -> std::result::Result<(), String> {
    let output = Command::new("git")
        .args(["lfs", "untrack", &pattern])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Get Git subtrees
#[tauri::command]
pub async fn get_subtrees(path: String) -> std::result::Result<Vec<SubtreeInfo>, String> {
    let output = Command::new("git")
        .args(["log", "--grep=git-subtree-dir", "--format=%b"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    let mut subtrees = std::collections::HashSet::new();
    if output.status.success() {
        let content = String::from_utf8_lossy(&output.stdout);
        let mut current_dir = None;
        let mut current_mainline = None;
        
        for line in content.lines() {
            if line.starts_with("git-subtree-dir:") {
                current_dir = Some(line.split(':').nth(1).unwrap_or("").trim().to_string());
            } else if line.starts_with("git-subtree-mainline:") {
                current_mainline = Some(line.split(':').nth(1).unwrap_or("").trim().to_string());
            }
            
            if let (Some(dir), Some(_)) = (&current_dir, &current_mainline) {
                subtrees.insert(dir.clone());
                current_dir = None;
                current_mainline = None;
            }
        }
    }

    let mut result = Vec::new();
    for dir in subtrees {
        result.push(SubtreeInfo {
            prefix: dir,
            remote: "unknown".to_string(),
            branch: "unknown".to_string(),
        });
    }

    Ok(result)
}

/// Add a new subtree
#[tauri::command]
pub async fn add_subtree(path: String, prefix: String, remote: String, branch: String) -> std::result::Result<(), String> {
    let output = Command::new("git")
        .args(["subtree", "add", "--prefix", &prefix, &remote, &branch, "--squash"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}
