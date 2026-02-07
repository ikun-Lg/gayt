use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub staged: Vec<StatusItem>,
    pub unstaged: Vec<StatusItem>,
    pub untracked: Vec<StatusItem>,
    pub conflicted: Vec<StatusItem>,
}

impl RepoStatus {
    pub fn new() -> Self {
        Self {
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
            conflicted: Vec::new(),
        }
    }

    pub fn has_changes(&self) -> bool {
        !self.staged.is_empty()
            || !self.unstaged.is_empty()
            || !self.untracked.is_empty()
            || !self.conflicted.is_empty()
    }

    #[allow(dead_code)]
    pub fn total_count(&self) -> usize {
        self.staged.len() + self.unstaged.len() + self.untracked.len() + self.conflicted.len()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusItem {
    pub path: String,
    pub status: FileStatus,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Unmerged,
    Unknown,
}

impl From<git2::Status> for FileStatus {
    fn from(status: git2::Status) -> Self {
        if status.is_index_new() || status.is_wt_new() {
            FileStatus::Added
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            FileStatus::Deleted
        } else if status.is_index_renamed() || status.is_wt_renamed() {
            FileStatus::Renamed
        } else if status.is_conflicted() {
            FileStatus::Unmerged
        } else {
            FileStatus::Modified
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSuggestion {
    pub r#type: CommitType,
    pub scope: Option<String>,
    pub description: String,
    pub body: Option<String>,
    pub formatted: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommitType {
    Feat,
    Fix,
    Docs,
    Style,
    Refactor,
    Perf,
    Test,
    Chore,
    Revert,
    Build,
    Ci,
}

impl CommitType {
    pub fn as_str(&self) -> &str {
        match self {
            CommitType::Feat => "feat",
            CommitType::Fix => "fix",
            CommitType::Docs => "docs",
            CommitType::Style => "style",
            CommitType::Refactor => "refactor",
            CommitType::Perf => "perf",
            CommitType::Test => "test",
            CommitType::Chore => "chore",
            CommitType::Revert => "revert",
            CommitType::Build => "build",
            CommitType::Ci => "ci",
        }
    }
}

impl CommitSuggestion {
    pub fn new(r#type: CommitType, description: impl Into<String>) -> Self {
        let description = description.into();
        let formatted = format!("{}: {}", r#type.as_str(), description);
        Self {
            r#type,
            scope: None,
            description,
            body: None,
            formatted,
        }
    }

    pub fn with_scope(mut self, scope: impl Into<String>) -> Self {
        self.scope = Some(scope.into());
        self.formatted = format!("{}({}): {}", self.r#type.as_str(), self.scope.as_ref().unwrap(), self.description);
        self
    }

    pub fn with_body(mut self, body: impl Into<String>) -> Self {
        self.body = Some(body.into());
        self.formatted = format!("{}\n\n{}", self.formatted, self.body.as_ref().unwrap());
        self
    }
}
