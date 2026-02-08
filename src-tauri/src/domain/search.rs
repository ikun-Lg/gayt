use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitSearchQuery {
    pub query: Option<String>,
    pub author: Option<String>,
    pub date_from: Option<i64>,
    pub date_to: Option<i64>,
    pub path: Option<String>,
    pub limit: Option<usize>,
}
