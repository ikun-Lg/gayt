use crate::domain::provider::{GitProvider, PullRequest, Issue, CreatePullRequest, CreateIssue};
use crate::error::{AppError, Result};
use async_trait::async_trait;
use reqwest::{Client, header};
use serde::Deserialize;

pub struct GitHubProvider {
    client: Client,
}

impl GitHubProvider {
    pub fn new(token: String) -> Self {
        let mut headers = header::HeaderMap::new();
        let mut auth_value = header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap();
        auth_value.set_sensitive(true);
        headers.insert(header::AUTHORIZATION, auth_value);
        headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/vnd.github.v3+json"));
        headers.insert(header::USER_AGENT, header::HeaderValue::from_static("gayt-app"));

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .unwrap();

        Self { client }
    }
}

#[derive(Deserialize)]
struct GitHubUser {
    login: String,
}

#[derive(Deserialize)]
struct GitHubPR {
    id: u64,
    number: u64,
    title: String,
    body: Option<String>,
    state: String,
    user: GitHubUser,
    created_at: String,
    updated_at: String,
    html_url: String,
    head: GitHubRef,
    base: GitHubRef,
}

#[derive(Deserialize)]
struct GitHubIssue {
    id: u64,
    number: u64,
    title: String,
    body: Option<String>,
    state: String,
    user: GitHubUser,
    created_at: String,
    updated_at: String,
    html_url: String,
    // GitHub issues API returns PRs too, but they have a pull_request field. 
    // We might need to filter them out if strictly looking for issues, 
    // or just treat them as issues.
    pull_request: Option<serde_json::Value>,
}

#[async_trait]
impl GitProvider for GitHubProvider {
    async fn get_pr_list(&self, owner: &str, repo: &str) -> Result<Vec<PullRequest>> {
        let url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", res.status()))));
        }

        let github_prs: Vec<GitHubPR> = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(github_prs.into_iter().map(|pr| PullRequest {
            id: pr.id.to_string(),
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            author: pr.user.login,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            url: pr.html_url,
            head_ref: pr.head.ref_name,
            base_ref: pr.base.ref_name,
        }).collect())
    }

    async fn get_issue_list(&self, owner: &str, repo: &str) -> Result<Vec<Issue>> {
        let url = format!("https://api.github.com/repos/{}/{}/issues", owner, repo);
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", res.status()))));
        }

        let github_issues: Vec<GitHubIssue> = res.json().await
             .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Filter out PRs (GitHub returns PRs in issues endpoint)
        let issues = github_issues.into_iter()
            .filter(|issue| issue.pull_request.is_none())
            .map(|issue| Issue {
                id: issue.id.to_string(),
                number: issue.number,
                title: issue.title,
                body: issue.body,
                state: issue.state,
                author: issue.user.login,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                url: issue.html_url,
            })
            .collect();
            
        Ok(issues)
    }

    async fn create_pr(&self, owner: &str, repo: &str, pr: CreatePullRequest) -> Result<PullRequest> {
         let url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);
         // GitHub API for create PR:
         // https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#create-a-pull-request
         // { "title": "...", "body": "...", "head": "...", "base": "..." }
         
         let body = serde_json::json!({
             "title": pr.title,
             "body": pr.body,
             "head": pr.head,
             "base": pr.base
         });

         let res = self.client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

         if !res.status().is_success() {
             let error_text = res.text().await.unwrap_or_default();
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", error_text))));
         }

         let pr: GitHubPR = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

         Ok(PullRequest {
            id: pr.id.to_string(),
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            author: pr.user.login,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            url: pr.html_url,
            head_ref: pr.head.ref_name,
            base_ref: pr.base.ref_name,
        })
    }

    async fn create_issue(&self, owner: &str, repo: &str, issue: CreateIssue) -> Result<Issue> {
         let url = format!("https://api.github.com/repos/{}/{}/issues", owner, repo);
         
         let body = serde_json::json!({
             "title": issue.title,
             "body": issue.body,
         });

         let res = self.client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

         if !res.status().is_success() {
             let error_text = res.text().await.unwrap_or_default();
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", error_text))));
         }

         let issue: GitHubIssue = res.json().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

         Ok(Issue {
                id: issue.id.to_string(),
                number: issue.number,
                title: issue.title,
                body: issue.body,
                state: issue.state,
                author: issue.user.login,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                url: issue.html_url,
         })
    }

    async fn get_commit_status(&self, owner: &str, repo: &str, sha: &str) -> Result<Vec<crate::domain::provider::CommitStatus>> {
        let url = format!("https://api.github.com/repos/{}/{}/commits/{}/check-runs", owner, repo, sha);
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", res.status()))));
        }

        #[derive(Deserialize)]
        struct GitHubCheckRuns {
            check_runs: Vec<GitHubCheckRun>,
        }

        #[derive(Deserialize)]
        struct GitHubCheckRun {
            id: u64,
            name: String,
            status: String,
            conclusion: Option<String>,
            html_url: String,
        }

        let checks: GitHubCheckRuns = res.json().await
             .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        let mut results: Vec<crate::domain::provider::CommitStatus> = checks.check_runs.into_iter().map(|c| {
            let status = if c.status == "completed" {
                c.conclusion.unwrap_or_else(|| "unknown".to_string())
            } else {
                c.status
            };

            crate::domain::provider::CommitStatus {
                id: c.id.to_string(),
                name: c.name,
                status,
                url: Some(c.html_url),
                description: None,
            }
        }).collect();

        // Also fetch legacy statuses (for Jenkins, etc.)
        let status_url = format!("https://api.github.com/repos/{}/{}/commits/{}/status", owner, repo, sha);
        let status_res = self.client.get(&status_url).send().await;
        if let Ok(res) = status_res {
             if res.status().is_success() {
                 #[derive(Deserialize)]
                 struct GitHubCombinedStatus {
                     statuses: Vec<GitHubStatusItem>,
                 }
                 #[derive(Deserialize)]
                 struct GitHubStatusItem {
                     id: u64,
                     context: String,
                     state: String,
                     target_url: Option<String>,
                     description: Option<String>,
                 }
                 
                 if let Ok(combined) = res.json::<GitHubCombinedStatus>().await {
                     for s in combined.statuses {
                         results.push(crate::domain::provider::CommitStatus {
                             id: s.id.to_string(),
                             name: s.context,
                             status: s.state,
                             url: s.target_url,
                             description: s.description,
                         });
                     }
                 }
             }
        }

        Ok(results)
    }

    async fn get_job_logs(&self, owner: &str, repo: &str, job_id: &str) -> Result<String> {
        // For GitHub Actions, we use the jobs API
        // GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
        let url = format!("https://api.github.com/repos/{}/{}/actions/jobs/{}/logs", owner, repo, job_id);
        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        if !res.status().is_success() {
             return Err(AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("GitHub API Error: {}", res.status()))));
        }

        let logs = res.text().await
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        Ok(logs)
    }
}

// Helper struct for nested head/base refs
#[derive(Deserialize)]
struct GitHubRef {
    #[serde(rename = "ref")]
    ref_name: String,
}
