// Repository types
export interface Repository {
  path: string;
  name: string;
  branch: string | null;
  hasChanges: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  ahead: number;
  behind: number;
}

export interface RepoStatus {
  staged: StatusItem[];
  unstaged: StatusItem[];
  untracked: StatusItem[];
  conflicted: StatusItem[];
}

export interface StatusItem {
  path: string;
  status: FileStatus;
  oldPath?: string;
}

export type FileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "unmerged"
  | "unknown";

export interface BranchInfo {
  current: string;
  ahead: number;
  behind: number;
  upstream: string | null;
  isPublished: boolean;
}

export interface LocalBranch {
  name: string;
  isHead: boolean;
  upstream: string | null;
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface CommitSuggestion {
  type: CommitType;
  scope?: string;
  description: string;
  body?: string;
  formatted: string;
}

export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "chore"
  | "revert"
  | "build"
  | "ci";

export interface BatchCommitResult {
  successes: string[];
  failures: BatchFailure[];
}

export interface BatchFailure {
  path: string;
  error: string;
}

// Settings types
export interface Settings {
  workDir: string | null;
  aiProvider: "heuristic" | "deepseek" | "glm";
  deepseekApiKey: string | null;
  glmApiKey: string | null;
  commitLanguage: "zh" | "en";
  commitFormat: "conventional" | "custom";
  customPrompt: string | null;
}
