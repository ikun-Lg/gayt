use crate::domain::provider::{GitProvider, PullRequest, Issue, CreatePullRequest, CreateIssue};
use crate::error::{AppError, Result};
use async_trait::async_trait;
use reqwest::{Client, header};
use serde::Deserialize;

pub struct GitLabProvider {
    client: Client,
    base_url: String,
}

impl GitLabProvider {
    pub fn new(token: String, base_url: Option<String>) -> Self {
        let mut headers = header::HeaderMap::new();
        // GitLab uses "PRIVATE-TOKEN" or "Authorization: Bearer <token>"
        // Using Bearer for consistency if it's OAuth or PAT
        let mut auth_value = header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap();
        auth_value.set_sensitive(true);
        headers.insert(header::AUTHORIZATION, auth_value);
        headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/json"));

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .unwrap();
        
        // Default to gitlab.com if not provided
        let base_url = base_url.unwrap_or_else(|| "https://gitlab.com".to_string());
        // Ensure no trailing slash
        let base_url = base_url.trim_end_matches('/').to_string();

        Self { client, base_url }
    }

    fn project_path(&self, owner: &str, repo: &str) -> String {
        // Project path needs to be URL encoded: owner/repo -> owner%2Frepo
        // For nested groups, all slashes must be encoded.
        let full_path = format!("{}/{}", owner, repo);
        full_path.replace("/", "%2F")
    }
}

#[derive(Deserialize)]
struct GitLabUser {
    username: String,
}

#[derive(Deserialize)]
struct GitLabMR {
    iid: u64,
    title: String,
    description: Option<String>,
    state: String, // opened, closed, locked, merged
    author: GitLabUser,
    created_at: String,
    updated_at: String,
    web_url: String,
    source_branch: String,
    target_branch: String,
}

#[derive(Deserialize)]
struct GitLabIssue {
    iid: u64,
    title: String,
    description: Option<String>,
    state: String, // opened, closed
    author: GitLabUser,
    created_at: String,
    updated_at: String,
    web_url: String,
}

#[async_trait]
impl GitProvider for GitLabProvider {
    async fn get_pr_list(&self, owner: &str, repo: &str) -> Result<Vec<PullRequest>> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/merge_requests?state=opened", self.base_url, project_path);
        
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", res.status()))));
        }

        let mrs: Vec<GitLabMR> = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(mrs.into_iter().map(|mr| PullRequest {
            id: mr.iid.to_string(), // we use iid (internal ID) which is the visible number
            number: mr.iid,
            title: mr.title,
            body: mr.description,
            state: mr.state,
            author: mr.author.username, // or name?
            created_at: mr.created_at,
            updated_at: mr.updated_at,
            url: mr.web_url,
            head_ref: mr.source_branch,
            base_ref: mr.target_branch,
        }).collect())
    }

    async fn get_issue_list(&self, owner: &str, repo: &str) -> Result<Vec<Issue>> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/issues?state=opened", self.base_url, project_path);

        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

         if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", res.status()))));
        }

        let issues: Vec<GitLabIssue> = res.json().await
             .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(issues.into_iter().map(|issue| Issue {
            id: issue.iid.to_string(),
            number: issue.iid,
            title: issue.title,
            body: issue.description,
            state: issue.state,
            author: issue.author.username,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.web_url,
        }).collect())
    }

    async fn create_pr(&self, owner: &str, repo: &str, pr: CreatePullRequest) -> Result<PullRequest> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/merge_requests", self.base_url, project_path);

        // GitLab API:
        // source_branch, target_branch, title, description
        let body = serde_json::json!({
            "source_branch": pr.head,
            "target_branch": pr.base,
            "title": pr.title,
            "description": pr.body
        });

        let res = self.client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_default();
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", error_text))));
        }

        let mr: GitLabMR = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(PullRequest {
            id: mr.iid.to_string(),
            number: mr.iid,
            title: mr.title,
            body: mr.description,
            state: mr.state,
            author: mr.author.username,
            created_at: mr.created_at,
            updated_at: mr.updated_at,
            url: mr.web_url,
            head_ref: mr.source_branch,
            base_ref: mr.target_branch,
        })
    }

    async fn create_issue(&self, owner: &str, repo: &str, issue: CreateIssue) -> Result<Issue> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/issues", self.base_url, project_path);

        let body = serde_json::json!({
            "title": issue.title,
            "description": issue.body
        });

        let res = self.client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             let error_text = res.text().await.unwrap_or_default();
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", error_text))));
        }

        let issue: GitLabIssue = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(Issue {
            id: issue.iid.to_string(),
            number: issue.iid,
            title: issue.title,
            body: issue.description,
            state: issue.state,
            author: issue.author.username,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.web_url,
        })
    }

    async fn get_commit_status(&self, owner: &str, repo: &str, sha: &str) -> Result<Vec<crate::domain::provider::CommitStatus>> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/repository/commits/{}/statuses", self.base_url, project_path, sha);
        
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", res.status()))));
        }

        #[derive(Deserialize)]
        struct GitLabStatus {
            id: u64,
            name: String,
            status: String,
            target_url: Option<String>,
            description: Option<String>,
        }

        let statuses: Vec<GitLabStatus> = res.json().await
             .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(statuses.into_iter().map(|s| {
            crate::domain::provider::CommitStatus {
                id: s.id.to_string(),
                name: s.name,
                status: s.status,
                url: s.target_url,
                description: s.description,
            }
        }).collect())
    }

    async fn get_job_logs(&self, owner: &str, repo: &str, job_id: &str) -> Result<String> {
        let project_path = self.project_path(owner, repo);
        let url = format!("{}/api/v4/projects/{}/jobs/{}/trace", self.base_url, project_path, job_id);
        
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitLab API Error: {}", res.status()))));
        }

        let logs = res.text().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(logs)
    }
}
