use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryInfo {
    pub path: String,
    pub name: String,
    pub branch: Option<String>,
    pub has_changes: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub current: String,
    pub ahead: usize,
    pub behind: usize,
    pub upstream: Option<String>,
    pub is_published: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBranch {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCommitResult {
    pub successes: Vec<String>,
    pub failures: Vec<BatchFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFailure {
    pub path: String,
    pub error: String,
}
