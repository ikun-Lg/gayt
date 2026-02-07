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

  generateCommitMessage: (repoPath: string, diffContent?: string) => Promise<CommitSuggestion>;
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

  // Actions
  setRepositories: (repos) => set({ repositories: repos }),

  selectRepo: (path) => {
    set({ selectedRepoPath: path, currentStatus: null, currentBranchInfo: null, localBranches: [] });
    if (path) {
      get().refreshStatus(path);
      get().refreshBranchInfo(path);
      get().loadLocalBranches(path);
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
}));
