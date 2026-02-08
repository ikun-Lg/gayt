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

// Conflict types
export interface ConflictInfo {
  path: string;
  current: string | null;
  incoming: string | null;
  ancestor: string | null;
  conflictMarkers: boolean;
}

export interface MergeState {
  isMergeInProgress: boolean;
  conflictCount: number;
  conflictedFiles: ConflictInfo[];
}

export type ConflictResolution = "current" | "incoming" | "ancestor" | "manual";

// Rebase types
export type RebaseCommand = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

export interface RebaseTodo {
  id: string;
  command: RebaseCommand;
  commit: CommitInfo;
  newMessage?: string;
}

export interface RebaseState {
  isRebaseInProgress: boolean;
  currentBranch: string | null;
  ontoBranch: string | null;
  currentStep: number;
  totalSteps: number;
  currentCommit: string | null;
}

export interface BranchInfo {
  current: string;
  ahead: number;
  behind: number;
  upstream: string | null;
  isPublished: boolean;
  needPush: boolean;
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
  parents: string[];
  refs: string[];
}

export interface CommitSearchQuery {
  query?: string;
  author?: string;
  dateFrom?: number;
  dateTo?: number;
  path?: string;
  limit?: number;
}

export interface CommitSuggestion {
  type: CommitType;
  scope?: string;
  description: string;
  body?: string;
  formatted: string;
}

export interface ReviewResult {
  content: string;
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

export interface StashInfo {
  index: number;
  message: string;
  id: string;
}

export interface TagInfo {
  name: string;
  message: string | null;
  target: string;
  tagger: string | null;
  date: number | null;
}

export interface RemoteInfo {
  name: string;
  url: string | null;
  pushUrl: string | null;
}

// Settings types
export interface Settings {
  workDir: string | null;
  aiProvider: "heuristic" | "deepseek" | "glm" | "openai" | "claude" | "ollama";
  deepseekApiKey: string | null;
  glmApiKey: string | null;
  openaiApiKey: string | null;
  openaiEndpoint: string | null;
  openaiModel: string | null;
  claudeApiKey: string | null;
  claudeEndpoint: string | null;
  claudeModel: string | null;
  ollamaEndpoint: string | null;
  ollamaModel: string | null;
  commitLanguage: "zh" | "en";
  commitFormat: "conventional" | "custom";
  customPrompt: string | null;
}

export interface DiffLine {
  content: string;
  origin: string; // char in rust, string in js
  oldLineno: number | null;
  newLineno: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
}
