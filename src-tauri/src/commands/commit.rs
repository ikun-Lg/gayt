use crate::domain::{CommitSuggestion, BatchCommitResult, BatchFailure};
use crate::error::{AppError, Result};
use git2::Repository;
use serde_json::json;

/// Stage files in a repository
#[tauri::command]
pub async fn stage_files(path: String, files: Vec<String>) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    stage_files_impl(&repo, &files).map_err(|e| e.to_string())
}

fn stage_files_impl(repo: &Repository, files: &[String]) -> Result<()> {
    let mut index = repo.index()?;

    for file in files {
        let path = std::path::Path::new(file);
        index.add_path(path)?;
    }

    index.write()?;
    Ok(())
}

/// Unstage files in a repository
#[tauri::command]
pub async fn unstage_files(path: String, files: Vec<String>) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    unstage_files_impl(&repo, &files).map_err(|e| e.to_string())
}

fn unstage_files_impl(repo: &Repository, files: &[String]) -> Result<()> {
    let mut index = repo.index()?;

    for file in files {
        let path = std::path::Path::new(file);
        index.remove_path(path)?;
    }

    index.write()?;
    Ok(())
}

/// Stage all files in a repository
#[tauri::command]
pub async fn stage_all(path: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    stage_all_impl(&repo).map_err(|e| e.to_string())
}

fn stage_all_impl(repo: &Repository) -> Result<()> {
    let mut index = repo.index()?;

    // Get all files
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut status_opts))?;

    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            if !entry.status().is_wt_deleted() {
                index.add_path(std::path::Path::new(path))?;
            }
        }
    }

    index.write()?;
    Ok(())
}

/// Unstage all files in a repository
#[tauri::command]
pub async fn unstage_all(path: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    // Reset to HEAD
    let head = repo.head().map_err(|e| e.to_string())?;
    let target = head.target().ok_or_else(|| "No HEAD".to_string())?;
    let obj = repo.find_object(target, None).map_err(|e| e.to_string())?;
    repo.reset(&obj, git2::ResetType::Mixed, None).map_err(|e| e.to_string())?;

    Ok(())
}

/// Commit changes in a repository
#[tauri::command]
pub async fn commit(path: String, message: String) -> std::result::Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    commit_impl(&repo, &message).map_err(|e| e.to_string())
}

fn commit_impl(repo: &Repository, message: &str) -> Result<String> {
    let signature = repo.signature()?;

    // Get the index and write the tree
    let mut index = repo.index()?;

    if index.is_empty() {
        return Err(AppError::NothingToCommit);
    }

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Check if this is the initial commit (unborn branch)
    let oid = if repo.head().is_ok() {
        // Normal case: we have existing commits
        let head = repo.head()?;
        let parent_commit = head.peel_to_commit()?;
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&parent_commit],
        )?
    } else {
        // Initial commit: no parents
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[],
        )?
    };

    Ok(format!("{:.7}", oid))
}

/// Revoke the latest commit (soft reset to HEAD~1)
#[tauri::command]
pub async fn revoke_latest_commit(path: String) -> std::result::Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    revoke_latest_commit_impl(&repo).map_err(|e| e.to_string())
}

fn revoke_latest_commit_impl(repo: &Repository) -> Result<()> {
    let head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    if head_commit.parent_count() == 0 {
        return Err(AppError::InvalidInput("Cannot revoke initial commit".to_string()));
    }

    let parent = head_commit.parent(0)?;

    // Soft reset: move HEAD to parent, keep index and working directory changes
    // This effectively "undoes" the commit but keeps changes staged
    repo.reset(parent.as_object(), git2::ResetType::Soft, None)?;

    Ok(())
}

/// Batch commit multiple repositories
#[tauri::command]
pub async fn batch_commit(paths: Vec<String>, message: String) -> std::result::Result<BatchCommitResult, String> {
    batch_commit_impl(&paths, &message).map_err(|e| e.to_string())
}

fn batch_commit_impl(paths: &[String], message: &str) -> Result<BatchCommitResult> {
    use rayon::prelude::*;

    let results: Vec<(String, Result<String>)> = paths
        .par_iter()
        .map(|path| {
            let result = || -> Result<String> {
                let repo = Repository::open(path)?;
                commit_impl(&repo, message)
            }();

            (path.clone(), result)
        })
        .collect();

    let mut successes = Vec::new();
    let mut failures = Vec::new();

    for (path, result) in results {
        match result {
            Ok(oid) => {
                successes.push(format!("{} ({})", path, oid));
            }
            Err(e) => {
                failures.push(BatchFailure {
                    path,
                    error: e.to_string(),
                });
            }
        }
    }

    Ok(BatchCommitResult {
        successes,
        failures,
    })
}

/// Generate commit message using AI or heuristics
#[tauri::command]
pub async fn generate_commit_message(
    path: String,
    provider: String,
    api_key: Option<String>,
    diff_content: Option<String>,
    commit_language: Option<String>,
    commit_format: Option<String>,
    custom_prompt: Option<String>,
) -> std::result::Result<CommitSuggestion, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    // Get diff for context
    let diff = if let Some(content) = diff_content {
        content
    } else {
        get_diff_summary(&repo).map_err(|e| e.to_string())?
    };

    let lang = commit_language.as_deref().unwrap_or("zh");
    let format = commit_format.as_deref().unwrap_or("conventional");

    match provider.as_str() {
        "deepseek" => generate_with_deepseek(&diff, api_key, lang, format, custom_prompt.as_deref()).await,
        "glm" => generate_with_glm(&diff, api_key, lang, format, custom_prompt.as_deref()).await,
        _ => generate_heuristic(&repo, &diff, lang),
    }
}

fn get_diff_summary(repo: &Repository) -> Result<String> {
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut status_opts))?;
    let mut summary = String::new();

    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let status = entry.status();

            let status_str = if status.is_index_new() || status.is_wt_new() {
                "A"
            } else if status.is_index_deleted() || status.is_wt_deleted() {
                "D"
            } else if status.is_index_modified() || status.is_wt_modified() {
                "M"
            } else if status.is_index_renamed() || status.is_wt_renamed() {
                "R"
            } else {
                "?"
            };

            summary.push_str(&format!("{} {}\n", status_str, path));
        }
    }

    Ok(summary)
}

fn generate_heuristic(repo: &Repository, _diff: &str, lang: &str) -> std::result::Result<CommitSuggestion, String> {
    use crate::domain::{CommitType, CommitSuggestion};

    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut status_opts)).map_err(|e| e.to_string())?;

    // Analyze changes to determine commit type and scope
    let mut commit_type = CommitType::Chore;
    let mut scopes: Vec<String> = Vec::new();
    let mut file_count = 0;

    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            file_count += 1;
            let status = entry.status();

            // Detect commit type from file path
            let path_lower = path.to_lowercase();

            if path_lower.contains("test") || path_lower.contains("spec") {
                commit_type = CommitType::Test;
            } else if path_lower.contains("doc") || path.ends_with(".md") || path.ends_with(".txt") {
                commit_type = CommitType::Docs;
            } else if path_lower.contains("style") || path_lower.contains("css") || path.ends_with(".scss") {
                commit_type = CommitType::Style;
            } else if status.is_index_deleted() || status.is_wt_deleted() {
                commit_type = CommitType::Fix;
            }

            // Extract scope from path
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() > 1 {
                let scope = parts[0];
                if !scopes.contains(&scope.to_string()) {
                    scopes.push(scope.to_string());
                }
            }
        }
    }

    // Generate description
    let description = if file_count == 1 {
        let first_path = statuses.iter()
            .filter_map(|e| e.path().map(|s| s.to_string()))
            .next()
            .unwrap_or_else(|| String::new());
        if lang == "zh" {
            format!("更新 {}", first_path)
        } else {
            format!("update {}", first_path)
        }
    } else {
        if lang == "zh" {
            format!("更新 {} 个文件", file_count)
        } else {
            format!("update {} file(s)", file_count)
        }
    };

    let mut suggestion = CommitSuggestion::new(commit_type, description);

    if scopes.len() == 1 {
        suggestion = suggestion.with_scope(&scopes[0]);
    }

    Ok(suggestion)
}

async fn generate_with_deepseek(
    diff: &str,
    api_key: Option<String>,
    lang: &str,
    format: &str,
    custom_prompt: Option<&str>,
) -> std::result::Result<CommitSuggestion, String> {
    let api_key = api_key.ok_or("DeepSeek 需要 API Key".to_string())?;

    let client = reqwest::Client::new();

    let (system_prompt, user_prompt) = if let Some(custom) = custom_prompt {
        let user_prompt = custom.replace("{{changes}}", diff);
        (
            "你是一个专业的 Git commit 消息生成助手。请只返回一个 commit 消息。".to_string(),
            user_prompt
        )
    } else {
        match (lang, format) {
            ("zh", "conventional") => (
                "你是一个专业的 Git commit 消息生成助手。请根据代码变更生成约定式提交消息。
返回格式为单个 JSON 对象（不是数组），包含以下字段：
- type: 类型 (feat/fix/docs/style/refactor/perf/test/chore/revert/build/ci)
- scope: 可选的作用域
- description: 简短的中文描述
- body: 可选的详细描述

请确保：
1. 只返回一个 JSON 对象，不要返回数组
2. type 使用小写英文
3. description 使用简洁的中文
4. 返回纯 JSON，不要包含 markdown 格式".to_string(),
                format!("请根据以下 Git 变更生成一个 commit 消息（只返回一个 JSON 对象）：\n\n{}", diff)
            ),
            ("en", "conventional") => (
                "You are a professional Git commit message generator. Generate conventional commit messages based on code changes.
Return a single JSON object (not an array) with these fields:
- type: commit type (feat/fix/docs/style/refactor/perf/test/chore/revert/build/ci)
- scope: optional scope
- description: short description in English
- body: optional detailed description

Requirements:
1. Return only ONE JSON object, not an array
2. Use lowercase for type
3. Use concise English for description
4. Return pure JSON without markdown formatting".to_string(),
                format!("Generate a single commit message for these changes (return one JSON object only):\n\n{}", diff)
            ),
            ("zh", "custom") => (
                "你是一个专业的 Git commit 消息生成助手。请只返回一个 commit 消息。".to_string(),
                format!("请为以下变更生成一个 commit 消息：\n\n{}", diff)
            ),
            _ => (
                "You are a professional Git commit message generator. Generate only ONE commit message.".to_string(),
                format!("Generate a single commit message for these changes:\n\n{}", diff)
            )
        }
    };

    let response = client
        .post("https://api.deepseek.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 500
        }))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {} - {}", status, text));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| format!("JSON error: {}", e))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format".to_string())?;

    // Parse the AI response
    parse_ai_response(content, lang)
}

async fn generate_with_glm(
    diff: &str,
    api_key: Option<String>,
    lang: &str,
    format: &str,
    custom_prompt: Option<&str>,
) -> std::result::Result<CommitSuggestion, String> {
    let api_key = api_key.ok_or("GLM 需要 API Key".to_string())?;

    let client = reqwest::Client::new();

    let (system_prompt, user_prompt) = if let Some(custom) = custom_prompt {
        let user_prompt = custom.replace("{{changes}}", diff);
        (
            "你是一个专业的 Git commit 消息生成助手。请只返回一个 commit 消息。".to_string(),
            user_prompt
        )
    } else {
        match (lang, format) {
            ("zh", "conventional") => (
                "你是一个专业的 Git commit 消息生成助手。请根据代码变更生成约定式提交消息。
返回格式为单个 JSON 对象（不是数组），包含以下字段：
- type: 类型 (feat/fix/docs/style/refactor/perf/test/chore/revert/build/ci)
- scope: 可选的作用域
- description: 简短的中文描述
- body: 可选的详细描述

请确保：
1. 只返回一个 JSON 对象，不要返回数组
2. type 使用小写英文
3. description 使用简洁的中文
4. 返回纯 JSON，不要包含 markdown 格式".to_string(),
                format!("请根据以下 Git 变更生成一个 commit 消息（只返回一个 JSON 对象）：\n\n{}", diff)
            ),
            ("en", "conventional") => (
                "You are a professional Git commit message generator. Generate conventional commit messages based on code changes.
Return a single JSON object (not an array) with these fields:
- type: commit type (feat/fix/docs/style/refactor/perf/test/chore/revert/build/ci)
- scope: optional scope
- description: short description in English
- body: optional detailed description

Requirements:
1. Return only ONE JSON object, not an array
2. Use lowercase for type
3. Use concise English for description
4. Return pure JSON without markdown formatting".to_string(),
                format!("Generate a single commit message for these changes (return one JSON object only):\n\n{}", diff)
            ),
            ("zh", "custom") => (
                "你是一个专业的 Git commit 消息生成助手。请只返回一个 commit 消息。".to_string(),
                format!("请为以下变更生成一个 commit 消息：\n\n{}", diff)
            ),
            _ => (
                "You are a professional Git commit message generator. Generate only ONE commit message.".to_string(),
                format!("Generate a single commit message for these changes:\n\n{}", diff)
            )
        }
    };

    let response = client
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": "glm-4-flash",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 500
        }))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {} - {}", status, text));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| format!("JSON error: {}", e))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format".to_string())?;

    parse_ai_response(content, lang)
}

fn parse_ai_response(content: &str, _lang: &str) -> std::result::Result<CommitSuggestion, String> {
    use crate::domain::{CommitType, CommitSuggestion};

    // Try to extract JSON from markdown code blocks
    let content = content.trim();
    let content = if content.starts_with("```") {
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() > 2 && lines[0].starts_with("```json") {
            lines[1..lines.len()-1].join("\n")
        } else if lines.len() > 2 {
            lines[1..lines.len()-1].join("\n")
        } else {
            content.to_string()
        }
    } else {
        content.to_string()
    };

    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|_| format!("Could not parse JSON from AI response: {}", content))?;

    // Handle array response (some LLMs return an array of suggestions)
    let json = if json.is_array() {
        json.as_array()
            .and_then(|arr| arr.first())
            .unwrap_or(&json)
    } else {
        &json
    };

    let type_str = json["type"].as_str().unwrap_or("chore");
    let scope = json["scope"].as_str().map(|s| s.to_string());
    let description = json["description"].as_str().unwrap_or("更新文件").to_string();
    let body = json["body"].as_str().map(|s| s.to_string());

    let commit_type = match type_str {
        "feat" => CommitType::Feat,
        "fix" => CommitType::Fix,
        "docs" => CommitType::Docs,
        "style" => CommitType::Style,
        "refactor" => CommitType::Refactor,
        "perf" => CommitType::Perf,
        "test" => CommitType::Test,
        "chore" => CommitType::Chore,
        "revert" => CommitType::Revert,
        "build" => CommitType::Build,
        "ci" => CommitType::Ci,
        _ => CommitType::Chore,
    };

    let mut suggestion = CommitSuggestion::new(commit_type, description);

    if let Some(scope) = scope {
        suggestion = suggestion.with_scope(scope);
    }

    if let Some(body) = body {
        suggestion = suggestion.with_body(body);
    }

    Ok(suggestion)
}
