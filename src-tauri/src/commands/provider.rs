use crate::domain::{GitProvider, PullRequest, Issue, CreatePullRequest, CreateIssue, CommitStatus};
use crate::infrastructure::github::GitHubProvider;
use crate::infrastructure::gitlab::GitLabProvider;
use crate::error::{AppError, Result};
use git2::Repository;
use url::Url;

#[tauri::command]
pub async fn fetch_pr_list(
    path: String,
    token: String,
    domain: Option<String>,
) -> std::result::Result<Vec<PullRequest>, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.get_pr_list(&owner, &repo).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_issue_list(
    path: String,
    token: String,
    domain: Option<String>,
) -> std::result::Result<Vec<Issue>, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.get_issue_list(&owner, &repo).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_pr(
    path: String,
    token: String,
    domain: Option<String>,
    pr: CreatePullRequest,
) -> std::result::Result<PullRequest, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.create_pr(&owner, &repo, pr).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_issue(
    path: String,
    token: String,
    domain: Option<String>,
    issue: CreateIssue,
) -> std::result::Result<Issue, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.create_issue(&owner, &repo, issue).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_commit_status(
    path: String,
    token: String,
    domain: Option<String>,
    sha: String,
) -> std::result::Result<Vec<CommitStatus>, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.get_commit_status(&owner, &repo, &sha).await.map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn fetch_job_logs(
    path: String,
    token: String,
    domain: Option<String>,
    job_id: String,
) -> std::result::Result<String, String> {
    let (provider, owner, repo) = get_provider_and_repo(&path, token, domain).map_err(|e| e.to_string())?;
    provider.get_job_logs(&owner, &repo, &job_id).await.map_err(|e| e.to_string())
}

fn get_provider_and_repo(
    path: &str,
    token: String,
    domain: Option<String>,
) -> Result<(Box<dyn GitProvider>, String, String)> {
    let repo = Repository::open(path)?;
    let remote = repo.find_remote("origin").map_err(|_| AppError::RepoNotFound("No remote 'origin' found".to_string()))?;
    let url_str = remote.url().ok_or(AppError::InvalidInput("No remote URL".to_string()))?;

    // Parse URL
    // handle git@... and https://...
    let (host, owner, repo_name) = parse_git_url(url_str)?;

    let provider: Box<dyn GitProvider> = if host == "github.com" {
        Box::new(GitHubProvider::new(token))
    } else if host == "gitlab.com" || domain.as_ref().map_or(false, |d| host == *d) {
        // For GitLab, we might need the base URL if it's self-hosted
        let base_url = if host == "gitlab.com" {
            None
        } else {
            Some(format!("https://{}", host)) // Assuming HTTPS for self-hosted
        };
        Box::new(GitLabProvider::new(token, base_url))
    } else {
        return Err(AppError::InvalidInput(format!("Unsupported provider host: {}", host)));
    };

    Ok((provider, owner, repo_name))
}

fn parse_git_url(url: &str) -> Result<(String, String, String)> {
    // Handle SSH: git@github.com:owner/repo.git
    if url.starts_with("git@") {
        let parts: Vec<&str> = url.split('@').collect();
        if parts.len() != 2 {
            return Err(AppError::InvalidInput("Invalid SSH URL format".to_string()));
        }
        let rest = parts[1];
        let parts: Vec<&str> = rest.split(':').collect();
        if parts.len() != 2 {
            return Err(AppError::InvalidInput("Invalid SSH URL format".to_string()));
        }
        let host = parts[0];
        let path = parts[1].trim_end_matches(".git");
        let path_parts: Vec<&str> = path.split('/').collect();
        if path_parts.len() < 2 {
             return Err(AppError::InvalidInput("Invalid repository path".to_string()));
        }
        // GitLab groups can be nested: group/subgroup/project
        // GitHub: owner/repo
        // We need to return owner (namespace) and repo (project name)
        // For GitLab, owner is "group/subgroup", repo is "project"
        let repo_name = path_parts.last().unwrap().to_string();
        let owner = path_parts[0..path_parts.len()-1].join("/");
        
        return Ok((host.to_string(), owner, repo_name));
    }

    // Handle HTTPS: https://github.com/owner/repo.git
    if let Ok(parsed_url) = Url::parse(url) {
        let host: &str = parsed_url.host_str().ok_or(AppError::InvalidInput("No host in URL".to_string()))?;
        let path = parsed_url.path().trim_start_matches('/').trim_end_matches(".git");
        let path_parts: Vec<&str> = path.split('/').collect();
        if path_parts.len() < 2 {
             return Err(AppError::InvalidInput("Invalid repository path".to_string()));
        }
        
        let repo_name = path_parts.last().unwrap().to_string();
        let owner = path_parts[0..path_parts.len()-1].join("/");

        return Ok((host.to_string(), owner, repo_name));
    }

    Err(AppError::InvalidInput("Could not parse remote URL".to_string()))
}
