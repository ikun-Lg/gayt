import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  Repository,
  RepoStatus,
  BranchInfo,
  CommitInfo,
  CommitSuggestion,
  BatchCommitResult,
  LocalBranch,
  ReviewResult,
  StashInfo,
} from '../types';

interface RepoStore {
  // State
  repositories: Repository[];
  selectedRepoPath: string | null;
  selectedRepoPaths: Set<string>;
  currentStatus: RepoStatus | null;
  currentBranchInfo: BranchInfo | null;
  localBranches: LocalBranch[];
  commitHistory: CommitInfo[];
  isLoading: boolean;
  error: string | null;
  stashes: StashInfo[];

  // Actions
  setRepositories: (repos: Repository[]) => void;
  selectRepo: (path: string | null) => void;
  toggleRepoSelection: (path: string) => void;
  clearSelection: () => void;
  setError: (error: string | null) => void;

  // Async actions
  scanRepositories: (rootPath: string) => Promise<void>;
  refreshStatus: (path: string) => Promise<void>;
  refreshBranchInfo: (path: string) => Promise<void>;
  refreshAllRepoStatus: () => Promise<void>;
  loadLocalBranches: (path: string) => Promise<void>;
  loadCommitHistory: (path: string, limit?: number) => Promise<void>;
  loadStashes: (path: string) => Promise<void>;

  // Git operations
  stageFile: (repoPath: string, filePath: string) => Promise<void>;
  unstageFile: (repoPath: string, filePath: string) => Promise<void>;
  stageAll: (repoPath: string) => Promise<void>;
  unstageAll: (repoPath: string) => Promise<void>;

  commit: (repoPath: string, message: string) => Promise<string>;
  revokeLatestCommit: (repoPath: string) => Promise<void>;
  batchCommit: (repoPaths: string[], message: string) => Promise<BatchCommitResult>;

  switchBranch: (path: string, branchName: string) => Promise<void>;
  publishBranch: (path: string, branchName: string, remote?: string, username?: string, password?: string) => Promise<void>;
  pushBranch: (path: string, branchName: string, remote?: string, username?: string, password?: string) => Promise<void>;
  deleteBranch: (path: string, branchName: string) => Promise<void>;
  renameBranch: (path: string, oldName: string, newName: string) => Promise<void>;
  createBranch: (path: string, newBranchName: string, baseBranchName: string) => Promise<void>;
  mergeBranch: (path: string, branchName: string) => Promise<void>;
  fetch: (path: string, remote?: string, username?: string, password?: string) => Promise<void>;
  pull: (path: string, remote?: string, branch?: string, useRebase?: boolean, username?: string, password?: string) => Promise<void>;
  
  stashSave: (path: string, message?: string, includeUntracked?: boolean) => Promise<void>;
  stashApply: (path: string, index: number) => Promise<void>;
  stashPop: (path: string, index: number) => Promise<void>;
  stashDrop: (path: string, index: number) => Promise<void>;

  generateCommitMessage: (repoPath: string, diffContent?: string) => Promise<CommitSuggestion>;
  reviewCode: (repoPath: string, diffContent?: string) => Promise<ReviewResult>;
  
  selectedFile: string | null;
  selectedFileDiff: string | null;
  selectFile: (repoPath: string, filePath: string | null) => Promise<void>;
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  // Initial state
  repositories: [],
  selectedRepoPath: null,
  selectedRepoPaths: new Set(),
  currentStatus: null,
  currentBranchInfo: null,
  localBranches: [],
  commitHistory: [],
  isLoading: false,
  error: null,
  stashes: [],
  selectedFile: null,
  selectedFileDiff: null,
  
  // Actions
  setRepositories: (repos) => set({ repositories: repos }),

  selectRepo: (path) => {
    set({ 
      selectedRepoPath: path, 
      currentStatus: null, 
      currentBranchInfo: null, 
      localBranches: [],
      selectedFile: null,
      selectedFileDiff: null
    });
    if (path) {
      get().refreshStatus(path);
      get().refreshBranchInfo(path);
      get().loadLocalBranches(path);
      get().loadStashes(path);
    }
  },

  toggleRepoSelection: (path) => {
    set((state) => {
      const newSelected = new Set(state.selectedRepoPaths);
      if (newSelected.has(path)) {
        newSelected.delete(path);
      } else {
        newSelected.add(path);
      }
      return { selectedRepoPaths: newSelected };
    });
  },

  clearSelection: () => set({ selectedRepoPaths: new Set() }),

  setError: (error) => set({ error }),

  // Async actions
  scanRepositories: async (rootPath) => {
    set({ isLoading: true, error: null });
    try {
      const repos = await invoke<Repository[]>('scan_repositories', { rootPath });
      set({ repositories: repos, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  refreshStatus: async (path) => {
    try {
      const status = await invoke<RepoStatus>('get_repo_status', { path });
      set({ currentStatus: status });

      // Update repository in list
      const repo = get().repositories.find((r) => r.path === path);
      if (repo) {
        const updatedRepo = {
          ...repo,
          hasChanges: status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0,
          stagedCount: status.staged.length,
          unstagedCount: status.unstaged.length,
          untrackedCount: status.untracked.length,
        };
        set((state) => ({
          repositories: state.repositories.map((r) =>
            r.path === path ? updatedRepo : r
          ),
        }));
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshBranchInfo: async (path) => {
    try {
      const branchInfo = await invoke<BranchInfo>('get_branch_info', { path });
      set({ currentBranchInfo: branchInfo });

      // Update repository in list
      const repo = get().repositories.find((r) => r.path === path);
      if (repo) {
        const updatedRepo = {
          ...repo,
          branch: branchInfo.current,
          ahead: branchInfo.ahead,
          behind: branchInfo.behind,
        };
        set((state) => ({
          repositories: state.repositories.map((r) =>
            r.path === path ? updatedRepo : r
          ),
        }));
      }
    } catch (e) {
      console.error('Failed to refresh branch info:', e);
    }
  },

  refreshAllRepoStatus: async () => {
    const { repositories } = get();
    // We could use Promise.all here, but to avoid overwhelming the system/git
    // we do them sequentially or in small batches. For now, sequential is fine.
    for (const repo of repositories) {
      try {
        const status = await invoke<RepoStatus>('get_repo_status', { path: repo.path });
        const branchInfo = await invoke<BranchInfo>('get_branch_info', { path: repo.path });
        
        const updatedRepo = {
          ...repo,
          hasChanges: status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0,
          stagedCount: status.staged.length,
          unstagedCount: status.unstaged.length,
          untrackedCount: status.untracked.length,
          branch: branchInfo.current,
          ahead: branchInfo.ahead,
          behind: branchInfo.behind,
        };

        set((state) => ({
          repositories: state.repositories.map((r) =>
            r.path === repo.path ? updatedRepo : r
          ),
          // If this is the currently selected repo, also update currentStatus and branchInfo
          ...(state.selectedRepoPath === repo.path ? { 
            currentStatus: status,
            currentBranchInfo: branchInfo
          } : {})
        }));
      } catch (e) {
        console.error(`Failed to refresh status for ${repo.path}:`, e);
      }
    }
  },

  loadLocalBranches: async (path) => {
    try {
      const branches = await invoke<LocalBranch[]>('get_local_branches', { path });
      set({ localBranches: branches });
    } catch (e) {
      console.error('Failed to load local branches:', e);
    }
  },

  loadStashes: async (path) => {
    try {
      const stashes = await invoke<StashInfo[]>('get_stash_list', { path });
      set({ stashes });
    } catch (e) {
      console.error('Failed to load stashes:', e);
    }
  },

  loadCommitHistory: async (path, limit = 20) => {
    try {
      const history = await invoke<CommitInfo[]>('get_commit_history', { path, limit });
      set({ commitHistory: history });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  // Git operations
  stageFile: async (repoPath, filePath) => {
    await invoke('stage_files', { path: repoPath, files: [filePath] });
    await get().refreshStatus(repoPath);
  },

  unstageFile: async (repoPath, filePath) => {
    await invoke('unstage_files', { path: repoPath, files: [filePath] });
    await get().refreshStatus(repoPath);
  },

  stageAll: async (repoPath) => {
    await invoke('stage_all', { path: repoPath });
    await get().refreshStatus(repoPath);
  },

  unstageAll: async (repoPath) => {
    await invoke('unstage_all', { path: repoPath });
    await get().refreshStatus(repoPath);
  },

  commit: async (repoPath, message) => {
    const result = await invoke<string>('commit', { path: repoPath, message });
    await get().refreshStatus(repoPath);
    await get().refreshBranchInfo(repoPath);
    return result;
  },

  revokeLatestCommit: async (repoPath) => {
    await invoke('revoke_latest_commit', { path: repoPath });
    await get().refreshStatus(repoPath);
    await get().refreshBranchInfo(repoPath);
  },

  batchCommit: async (repoPaths, message) => {
    const result = await invoke<BatchCommitResult>('batch_commit', {
      paths: repoPaths,
      message,
    });

    // Refresh all affected repos
    for (const path of repoPaths) {
      await get().refreshStatus(path);
      await get().refreshBranchInfo(path);
    }

    return result;
  },

  switchBranch: async (path, branchName) => {
    await invoke('switch_branch', { path, branchName });
    await get().refreshBranchInfo(path);
    await get().refreshStatus(path);
    await get().loadLocalBranches(path);
  },

  publishBranch: async (path, branchName, remote = 'origin', username?: string, password?: string) => {
    await invoke('publish_branch', { path, branchName, remote, username, password });
    await get().refreshBranchInfo(path);
    await get().loadLocalBranches(path);
  },

  pushBranch: async (path, branchName, remote = 'origin', username?: string, password?: string) => {
    await invoke('push_branch', { path, branchName, remote, username, password });
    await get().refreshBranchInfo(path);
  },

  deleteBranch: async (path, branchName) => {
    await invoke('delete_branch', { path, branchName });
    await get().loadLocalBranches(path);
    const current = get().currentBranchInfo?.current;
    if (current === branchName) {
      await get().refreshBranchInfo(path);
    }
  },

  renameBranch: async (path, oldName, newName) => {
    await invoke('rename_branch', { path, oldName, newName });
    await get().loadLocalBranches(path);
    const current = get().currentBranchInfo?.current;
    if (current === oldName) {
      await get().refreshBranchInfo(path);
    }
  },

  createBranch: async (path, newBranchName, baseBranchName) => {
    await invoke('create_branch', { path, newBranchName, baseBranchName });
    await get().loadLocalBranches(path);
  },

  mergeBranch: async (path, branchName) => {
    await invoke('merge_branch', { path, branchName });
    await get().refreshStatus(path);
    await get().refreshBranchInfo(path);
    await get().loadCommitHistory(path);
  },

  fetch: async (path, remote = 'origin', username, password) => {
    await invoke('fetch_remote', { path, remote, username, password });
    await get().refreshBranchInfo(path);
    await get().loadCommitHistory(path);
  },

  pull: async (path, remote = 'origin', branch, useRebase = false, username, password) => {
    // If branch is not specified, use current branch
    const targetBranch = branch || get().currentBranchInfo?.current;
    if (!targetBranch) throw new Error("No branch selected");

    await invoke('pull_branch', { 
      path, 
      remote, 
      branch: targetBranch, 
      useRebase, 
      username, 
      password 
    });
    
    await get().refreshStatus(path);
    await get().refreshBranchInfo(path);
    await get().loadCommitHistory(path);
    await get().loadLocalBranches(path);
  },

  stashSave: async (path, message, includeUntracked = false) => {
    await invoke('stash_save', { path, message, includeUntracked });
    await get().loadStashes(path);
    await get().refreshStatus(path);
  },

  stashApply: async (path, index) => {
    await invoke('stash_apply', { path, index });
    await get().refreshStatus(path);
  },

  stashPop: async (path, index) => {
    await invoke('stash_pop', { path, index });
    await get().loadStashes(path);
    await get().refreshStatus(path);
  },

  stashDrop: async (path, index) => {
    await invoke('stash_drop', { path, index });
    await get().loadStashes(path);
  },

  generateCommitMessage: async (repoPath, diffContent) => {
    // Import settings store dynamically to avoid circular dependency
    const { useSettingsStore } = await import('./settingsStore');
    const settings = useSettingsStore.getState();

    return await invoke<CommitSuggestion>('generate_commit_message', {
      path: repoPath,
      provider: settings.aiProvider,
      apiKey: settings.aiProvider === 'deepseek' ? settings.deepseekApiKey : settings.glmApiKey,
      diffContent,
      commitLanguage: settings.commitLanguage,
      commitFormat: settings.commitFormat,
      customPrompt: settings.customPrompt,
    });
  },

  reviewCode: async (repoPath, diffContent) => {
     // Import settings store dynamically to avoid circular dependency
    const { useSettingsStore } = await import('./settingsStore');
    const settings = useSettingsStore.getState();

    const content = await invoke<string>('review_code', {
      path: repoPath,
      provider: settings.aiProvider,
      apiKey: settings.aiProvider === 'deepseek' ? settings.deepseekApiKey : settings.glmApiKey,
      diffContent,
      customPrompt: settings.customPrompt,
    });

    return { content };
  },

  selectFile: async (repoPath, filePath) => {
    if (!filePath) {
      set({ selectedFile: null, selectedFileDiff: null });
      return;
    }

    try {
      const diff = await invoke<string>('get_file_diff', { path: repoPath, filePath });
      set({ selectedFile: filePath, selectedFileDiff: diff });
    } catch (e) {
      console.error('Failed to get file diff:', e);
      set({ selectedFile: filePath, selectedFileDiff: 'Error loading diff' });
    }
  },
}));
