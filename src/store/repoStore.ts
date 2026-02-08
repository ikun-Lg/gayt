import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { operationHistory } from '../lib/operationHistory';
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
  TagInfo,
  RemoteInfo,
  RemoteBranch,
  MergeState,
  ConflictResolution,
  RebaseState,
  RebaseTodo,
  FileDiff,
  SubmoduleInfo,
  SubtreeInfo,
  LfsStatus,
} from '../types';

interface RepoStore {
  // State
  repositories: Repository[];
  selectedRepoPath: string | null;
  selectedRepoPaths: Set<string>;
  currentStatus: RepoStatus | null;
  currentBranchInfo: BranchInfo | null;
  localBranches: LocalBranch[];
  remoteBranches: RemoteBranch[];
  commitHistory: CommitInfo[];
  isLoading: boolean;
  error: string | null;
  stashes: StashInfo[];
  tags: TagInfo[];
  remotes: RemoteInfo[];
  mergeState: MergeState | null;
  rebaseState: RebaseState | null;
  historyChangeCount: number;
  submodules: SubmoduleInfo[];
  subtrees: SubtreeInfo[];
  lfsStatus: LfsStatus | null;

  // Pagination state
  hasMoreCommits: boolean;
  isLoadingMoreCommits: boolean;
  commitsPageSize: number;

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
  loadRemoteBranches: (path: string) => Promise<void>;
  loadCommitHistory: (path: string, limit?: number) => Promise<void>;
  loadMoreCommits: (path: string) => Promise<void>;
  loadStashes: (path: string) => Promise<void>;
  loadTags: (path: string) => Promise<void>;
  loadRemotes: (path: string) => Promise<void>;

  // Git operations
  stageFile: (repoPath: string, filePath: string) => Promise<void>;
  unstageFile: (repoPath: string, filePath: string) => Promise<void>;
  discardFile: (repoPath: string, filePath: string) => Promise<void>;
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
  cloneRepository: (url: string, destination: string, username?: string, password?: string) => Promise<void>;
  
  stashSave: (path: string, message?: string, includeUntracked?: boolean) => Promise<void>;
  stashApply: (path: string, index: number) => Promise<void>;
  stashPop: (path: string, index: number) => Promise<void>;
  stashDrop: (path: string, index: number) => Promise<void>;

  createTag: (path: string, name: string, message?: string, target?: string) => Promise<void>;
  deleteTag: (path: string, name: string) => Promise<void>;
  pushTag: (path: string, tagName: string, remote?: string, username?: string, password?: string) => Promise<void>;
  deleteRemoteTag: (path: string, tagName: string, remote?: string, username?: string, password?: string) => Promise<void>;

  addRemote: (path: string, name: string, url: string) => Promise<void>;
  removeRemote: (path: string, name: string) => Promise<void>;
  renameRemote: (path: string, oldName: string, newName: string) => Promise<void>;
  setRemoteUrl: (path: string, name: string, url: string) => Promise<void>;

  // Submodule actions
  loadSubmodules: (path: string) => Promise<void>;
  updateSubmodule: (path: string) => Promise<void>;
  initSubmodule: (path: string) => Promise<void>;

  // LFS actions
  loadLfsStatus: (path: string) => Promise<void>;
  lfsTrack: (path: string, pattern: string) => Promise<void>;
  lfsUntrack: (path: string, pattern: string) => Promise<void>;

  // Subtree actions
  loadSubtrees: (path: string) => Promise<void>;
  addSubtree: (path: string, prefix: string, remote: string, branch: string) => Promise<void>;

  // Conflict operations
  getMergeState: (path: string) => Promise<void>;
  resolveConflict: (path: string, filePath: string, version: ConflictResolution) => Promise<void>;
  getConflictDiff: (path: string, filePath: string) => Promise<string>;
  abortMerge: (path: string) => Promise<void>;
  completeMerge: (path: string, message?: string) => Promise<void>;

  // Rebase operations
  getRebaseState: (path: string) => Promise<void>;
  startInteractiveRebase: (path: string, baseCommit: string, commits: RebaseTodo[]) => Promise<void>;
  continueRebase: (path: string) => Promise<void>;
  skipRebase: (path: string) => Promise<void>;
  abortRebase: (path: string) => Promise<void>;
  amendRebaseCommit: (path: string, newMessage: string) => Promise<void>;

  generateCommitMessage: (repoPath: string, diffContent?: string) => Promise<CommitSuggestion>;
  reviewCode: (repoPath: string, diffContent?: string) => Promise<ReviewResult>;

  selectedFile: string | null;
  selectedFileDiff: FileDiff | null;
  selectFile: (repoPath: string, filePath: string | null) => Promise<void>;
  stageChunk: (repoPath: string, patch: string) => Promise<void>;
  
  // Undo/Redo
  undoLastOperation: (path: string) => Promise<void>;
  redoLastOperation: (path: string) => Promise<void>;
  
  // Internal helper actions (to separate recording)
  stageAllInternal: (path: string, record?: boolean) => Promise<void>;
  unstageAllInternal: (path: string, record?: boolean) => Promise<void>;
  commitInternal: (path: string, message: string, record?: boolean) => Promise<string>;

  // Search
  searchResults: CommitInfo[] | null;
  isSearching: boolean;
  searchCommits: (path: string, query: import('../types').CommitSearchQuery) => Promise<void>;
  clearSearchResults: () => void;
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  // Initial state
  repositories: [],
  selectedRepoPath: null,
  selectedRepoPaths: new Set(),
  currentStatus: null,
  currentBranchInfo: null,
  localBranches: [],
  remoteBranches: [],
  commitHistory: [],
  isLoading: false,
  error: null,
  stashes: [],
  tags: [],
  remotes: [],
  submodules: [],
  subtrees: [],
  lfsStatus: null,
  selectedFile: null,
  selectedFileDiff: null,
  mergeState: null,
  rebaseState: null,
  historyChangeCount: 0,
  hasMoreCommits: true,
  isLoadingMoreCommits: false,
  commitsPageSize: 50,
  
  // Actions
  setRepositories: (repos) => set({ repositories: repos }),

  selectRepo: (path) => {
    set({
      selectedRepoPath: path,
      currentStatus: null,
      currentBranchInfo: null,
      localBranches: [],
      remoteBranches: [],
      selectedFile: null,
      selectedFileDiff: null,
      tags: [],
      remotes: [],
      mergeState: null,
    });
    if (path) {
      get().refreshStatus(path);
      get().refreshBranchInfo(path);
      get().loadLocalBranches(path);
      get().loadRemoteBranches(path);
      get().loadStashes(path);
      get().loadTags(path);
      get().loadRemotes(path);
      get().getMergeState(path);
      get().loadSubmodules(path);
      get().loadLfsStatus(path);
      get().loadSubtrees(path);
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

  loadRemoteBranches: async (path) => {
    try {
      const branches = await invoke<RemoteBranch[]>('get_remote_branches', { path });
      set({ remoteBranches: branches });
    } catch (e) {
      console.error('Failed to load remote branches:', e);
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

  loadCommitHistory: async (path, limit = 50) => {
    try {
      const history = await invoke<CommitInfo[]>('get_commit_history_paginated', { path, skip: 0, limit });
      set({
        commitHistory: history,
        hasMoreCommits: history.length === limit,
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadMoreCommits: async (path) => {
    const { commitHistory, commitsPageSize, isLoadingMoreCommits } = get();
    if (isLoadingMoreCommits) return;

    set({ isLoadingMoreCommits: true });

    try {
      const moreCommits = await invoke<CommitInfo[]>('get_commit_history_paginated', {
        path,
        skip: commitHistory.length,
        limit: commitsPageSize,
      });

      set((state) => ({
        commitHistory: [...state.commitHistory, ...moreCommits],
        hasMoreCommits: moreCommits.length === commitsPageSize,
        isLoadingMoreCommits: false,
      }));
    } catch (e) {
      set({ error: String(e), isLoadingMoreCommits: false });
    }
  },

  undoLastOperation: async (path: string) => {
    const op = operationHistory.performUndo(path);
    if (!op) return;

    try {
      switch (op.type) {
        case 'commit':
          await get().revokeLatestCommit(path);
          break;
        case 'stage':
          if (op.undoData && Array.isArray(op.undoData)) {
            await invoke('unstage_files', { path, files: op.undoData });
            await get().refreshStatus(path);
          }
          break;
        case 'unstage':
          if (op.undoData && Array.isArray(op.undoData)) {
             await invoke('stage_files', { path, files: op.undoData });
             await get().refreshStatus(path);
          }
          break;
        case 'stage-all':
            await get().unstageAllInternal(path, false); // Don't record this internal call
            break;
        case 'unstage-all':
            await get().stageAllInternal(path, false);
            break;
      }
      set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
    } catch (e) {
      console.error("Undo failed", e);
      // If undo failed, we might want to restore history pointer?
      // For now, let's assume it worked or user can try again.
    }
  },

  redoLastOperation: async (path: string) => {
    const op = operationHistory.performRedo(path);
    if (!op) return;
    
    try {
       switch (op.type) {
        case 'commit':
            // Redoing a commit is hard because we need the message and files.
            // Only support if we saved them in undoData or if we can just re-commit staged.
            // For now, commit redo might be complex.
            // Actually, if we just revoked (soft reset), the changes are staged.
            // So we just need to commit again with the SAME message.
            if (op.description && typeof op.undoData === 'object') {
                 // We need to store message in operation data.
                 // Let's assume description IS the message or we store it.
                 // For now, use description.
                 // Extract message from description "Commit: <msg>"?
                 // Better to store 'message' in undoData.
                 const msg = (op.undoData as any)?.message;
                 if (msg) {
                     await get().commitInternal(path, msg, false);
                 }
            }
            break;
        case 'stage':
             if (op.undoData && Array.isArray(op.undoData)) {
                await invoke('stage_files', { path, files: op.undoData });
                await get().refreshStatus(path);
             }
             break;
        case 'unstage':
              if (op.undoData && Array.isArray(op.undoData)) {
                await invoke('unstage_files', { path, files: op.undoData });
                await get().refreshStatus(path);
              }
              break;
         case 'stage-all':
             await get().stageAllInternal(path, false);
             break;
         case 'unstage-all':
             await get().unstageAllInternal(path, false);
             break;
       }
       set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
    } catch (e) {
        console.error("Redo failed", e);
    }
  },

  // Internal helpers to avoid double recording
  stageAllInternal: async (repoPath, record = true) => {
      await invoke('stage_all', { path: repoPath });
      await get().refreshStatus(repoPath);
      if (record) {
          operationHistory.record({
              repoPath,
              type: 'stage-all', // Use specific type
              description: '全部暂存',
              undoable: true,
              undoData: null // We don't track exact files for all, just reverse with unstageAll
          } as any);
          set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
      }
  },

  unstageAllInternal: async (repoPath, record = true) => {
      await invoke('unstage_all', { path: repoPath });
      await get().refreshStatus(repoPath);
      if (record) {
          operationHistory.record({
              repoPath,
              type: 'unstage-all',
              description: '全部取消暂存',
              undoable: true,
              undoData: null
          } as any);
          set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
      }
  },

  commitInternal: async (repoPath, message, record = true) => {
    const result = await invoke<string>('commit', { path: repoPath, message });
    await get().refreshStatus(repoPath);
    await get().refreshBranchInfo(repoPath);
    if (record) {
         operationHistory.record({
              repoPath,
              type: 'commit',
              description: message,
              undoable: true,
              undoData: { message } // Store message for redo
          });
         set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
    }
    return result;
  },

  // Git operations
  stageFile: async (repoPath, filePath) => {
    await invoke('stage_files', { path: repoPath, files: [filePath] });
    await get().refreshStatus(repoPath);
    operationHistory.record({
      repoPath,
      type: 'stage',
      description: `暂存 ${filePath.split('/').pop()}`,
      undoable: true,
      undoData: [filePath]
    });
    set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
  },

  unstageFile: async (repoPath, filePath) => {
    await invoke('unstage_files', { path: repoPath, files: [filePath] });
    await get().refreshStatus(repoPath);
    operationHistory.record({
      repoPath,
      type: 'unstage',
      description: `取消暂存 ${filePath.split('/').pop()}`,
      undoable: true,
      undoData: [filePath]
    });
    set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
  },

  discardFile: async (repoPath, filePath) => {
    await invoke('discard_files', { path: repoPath, files: [filePath] });
    // Clear selected file if it was the discarded one
    const { selectedFile } = get();
    if (selectedFile === filePath) {
      set({ selectedFile: null, selectedFileDiff: null });
    }
    await get().refreshStatus(repoPath);
    // Discard is irreversible for now, so we don't record it as undoable
      operationHistory.record({
      repoPath,
      type: 'discard', // Ensure 'discard' is in OperationType
      description: `丢弃更改 ${filePath.split('/').pop()}`,
      undoable: false,
    });
    set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
  },

  stageAll: async (repoPath) => {
      await get().stageAllInternal(repoPath, true);
  },

  unstageAll: async (repoPath) => {
      await get().unstageAllInternal(repoPath, true);
  },

  commit: async (repoPath, message) => {
    return await get().commitInternal(repoPath, message, true);
  },

  revokeLatestCommit: async (repoPath) => {
    await invoke('revoke_latest_commit', { path: repoPath });
    await get().refreshStatus(repoPath);
    await get().refreshBranchInfo(repoPath);
    // Revoke is an action itself. Should we record it?
    // If we record it, undoing it means... "Un-revoke"? i.e. Commit again.
    // Ideally, "Undo Commit" IS the revoke action triggered by undoing the commit operation.
    // But user can also click "Revoke" button manually.
    // If they click manually, we should record it so they can Undo the Revoke (Re-commit).
    // Yes.
     operationHistory.record({
        repoPath,
        type: 'revert', // or custom type 'revoke'
        description: '撤回提交',
        undoable: false, // For now, let's say manual revoke is not easily undoable unless we know exactly what it did.
                         // Actually, if we just re-commit, it is undoable.
                         // But we need the message of the revoked commit!
                         // The helper `revoke_latest_commit` doesn't return the message.
                         // So we can't easily undo a manual revoke unless we fetch the old HEAD message first.
    });
     set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));
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
       // Record for each repo?
       operationHistory.record({
          repoPath: path,
          type: 'commit',
          description: message,
          undoable: true,
          undoData: { message }
       });
    }
    set(state => ({ historyChangeCount: state.historyChangeCount + 1 }));

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
      apiKey: settings.aiProvider === 'deepseek' ? settings.deepseekApiKey : 
              settings.aiProvider === 'glm' ? settings.glmApiKey :
              settings.aiProvider === 'openai' ? settings.openaiApiKey :
              settings.aiProvider === 'claude' ? settings.claudeApiKey : null,
      apiEndpoint: settings.aiProvider === 'openai' ? settings.openaiEndpoint :
                   settings.aiProvider === 'claude' ? settings.claudeEndpoint :
                   settings.aiProvider === 'ollama' ? settings.ollamaEndpoint : null,
      model: settings.aiProvider === 'openai' ? settings.openaiModel :
             settings.aiProvider === 'claude' ? settings.claudeModel :
             settings.aiProvider === 'ollama' ? settings.ollamaModel : null,
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
      apiKey: settings.aiProvider === 'deepseek' ? settings.deepseekApiKey : 
              settings.aiProvider === 'glm' ? settings.glmApiKey :
              settings.aiProvider === 'openai' ? settings.openaiApiKey :
              settings.aiProvider === 'claude' ? settings.claudeApiKey : null,
      apiEndpoint: settings.aiProvider === 'openai' ? settings.openaiEndpoint :
                   settings.aiProvider === 'claude' ? settings.claudeEndpoint :
                   settings.aiProvider === 'ollama' ? settings.ollamaEndpoint : null,
      model: settings.aiProvider === 'openai' ? settings.openaiModel :
             settings.aiProvider === 'claude' ? settings.claudeModel :
             settings.aiProvider === 'ollama' ? settings.ollamaModel : null,
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
      const diff = await invoke<FileDiff>('get_file_diff', { path: repoPath, filePath });
      set({ selectedFile: filePath, selectedFileDiff: diff });
    } catch (e) {
      console.error('Failed to get file diff:', e);
      set({ selectedFile: filePath, selectedFileDiff: null }); 
    }
  },

  stageChunk: async (repoPath, patch) => {
      console.log('stageChunk called with:', { repoPath, patchLength: patch.length });
      if (!repoPath) {
        console.error('stageChunk: repoPath is missing!');
        return; // Early return to prevent IPC error, though we want to fix the caller
      }
      await invoke('apply_patch', { path: repoPath, patch });
      // Refresh status and re-fetch diff to show updated state
      await get().refreshStatus(repoPath);
      const selectedFile = get().selectedFile;
      if (selectedFile) {
          await get().selectFile(repoPath, selectedFile);
      }
  },

  cloneRepository: async (url, destination, username, password) => {
    // Listen for progress events
    const processUnlisten = await import('@tauri-apps/api/event').then(entry => {
        return entry.listen('clone-progress', (event: any) => {
             // We can store this in a separate store or just log it for now
             console.log('Clone progress:', event.payload);
        });
    });

    try {
      const path = await invoke<string>('clone_repository', { 
        url, 
        destination, 
        username, 
        password 
      });
      
       const parentDir = destination.substring(0, destination.lastIndexOf('/'));
       await get().scanRepositories(parentDir);
       
       get().selectRepo(path);
    } finally {
      processUnlisten();
    }
  },

  loadTags: async (path) => {
    try {
      const tags = await invoke<TagInfo[]>('get_tags', { path });
      set({ tags });
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  },

  createTag: async (path, name, message, target) => {
    await invoke('create_tag', { path, name, message, target });
    await get().loadTags(path);
  },

  // Search
  searchResults: null,
  isSearching: false,
  
  searchCommits: async (path, query) => {
    set({ isSearching: true, error: null });
    try {
        const results = await invoke<CommitInfo[]>('search_commits', { path, query });
        set({ searchResults: results, isSearching: false });
    } catch (e) {
        set({ error: String(e), isSearching: false, searchResults: [] });
    }
  },

  clearSearchResults: () => {
    set({ searchResults: null, isSearching: false });
  },

  deleteTag: async (path, name) => {
    await invoke('delete_tag', { path, name });
    await get().loadTags(path);
  },

  pushTag: async (path, tagName, remote = 'origin', username, password) => {
    await invoke('push_tag', { path, tagName, remote, username, password });
  },

  deleteRemoteTag: async (path, tagName, remote = 'origin', username, password) => {
    await invoke('delete_remote_tag', { path, tagName, remote, username, password });
  },

  loadRemotes: async (path) => {
    try {
      const remotes = await invoke<RemoteInfo[]>('get_remotes', { path });
      set({ remotes });
    } catch (e) {
      console.error('Failed to load remotes:', e);
    }
  },

  addRemote: async (path, name, url) => {
    await invoke('add_remote', { path, name, url });
    await get().loadRemotes(path);
  },

  removeRemote: async (path, name) => {
    await invoke('remove_remote', { path, name });
    await get().loadRemotes(path);
  },

  renameRemote: async (path, oldName, newName) => {
    await invoke('rename_remote', { path, oldName, newName });
    await get().loadRemotes(path);
  },

  setRemoteUrl: async (path, name, url) => {
    await invoke('set_remote_url', { path, name, url });
    await get().loadRemotes(path);
  },

  // Conflict operations
  getMergeState: async (path) => {
    try {
      const mergeState = await invoke<MergeState>('get_merge_state', { path });
      set({ mergeState });
    } catch (e) {
      console.error('Failed to get merge state:', e);
      set({ mergeState: null });
    }
  },

  resolveConflict: async (path, filePath, version) => {
    await invoke('resolve_conflict', { path, filePath, version });
    // Refresh merge state to update conflict count
    await get().getMergeState(path);
    await get().refreshStatus(path);
  },

  getConflictDiff: async (path, filePath) => {
    return await invoke<string>('get_conflict_diff', { path, filePath });
  },

  abortMerge: async (path) => {
    await invoke('abort_merge', { path });
    await get().getMergeState(path);
    await get().refreshStatus(path);
    await get().refreshBranchInfo(path);
  },

  completeMerge: async (path, message) => {
    await invoke('complete_merge', { path, message });
    await get().getMergeState(path);
    await get().refreshStatus(path);
    await get().refreshBranchInfo(path);
    await get().loadCommitHistory(path);
  },

  // Rebase operations
  getRebaseState: async (path) => {
    try {
      const rebaseState = await invoke<RebaseState>('get_rebase_state', { path });
      set({ rebaseState });
    } catch (e) {
      console.error('Failed to get rebase state:', e);
      set({ rebaseState: null });
    }
  },

  startInteractiveRebase: async (path, baseCommit, commits) => {
    await invoke('start_interactive_rebase', { path, baseCommit: baseCommit, commits });
    await get().getRebaseState(path);
    await get().refreshStatus(path);
    await get().loadCommitHistory(path);
  },

  continueRebase: async (path) => {
    await invoke('continue_rebase', { path });
    await get().getRebaseState(path);
    await get().refreshStatus(path);
    await get().loadCommitHistory(path);
  },

  skipRebase: async (path) => {
    await invoke('skip_rebase', { path });
    await get().getRebaseState(path);
    await get().refreshStatus(path);
    await get().loadCommitHistory(path);
  },

  abortRebase: async (path) => {
    await invoke('abort_rebase', { path });
    await get().getRebaseState(path);
    await get().refreshStatus(path);
    await get().loadCommitHistory(path);
  },

  amendRebaseCommit: async (path, newMessage) => {
    await invoke('amend_rebase_commit', { path, newMessage });
    await get().loadCommitHistory(path);
  },

  loadSubmodules: async (path) => {
    try {
      const submodules = await invoke<SubmoduleInfo[]>('get_submodules', { path });
      set({ submodules });
    } catch (e) {
      console.error('Failed to load submodules:', e);
    }
  },

  updateSubmodule: async (path) => {
    try {
      await invoke('update_submodule', { path });
      await get().loadSubmodules(path);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  initSubmodule: async (path) => {
    try {
      await invoke('init_submodule', { path });
      await get().loadSubmodules(path);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadLfsStatus: async (path) => {
    try {
      const lfsStatus = await invoke<LfsStatus>('get_lfs_status', { path });
      set({ lfsStatus });
    } catch (e) {
      console.error('Failed to load LFS status:', e);
    }
  },

  lfsTrack: async (path, pattern) => {
    try {
      await invoke('lfs_track', { path, pattern });
      await get().loadLfsStatus(path);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  lfsUntrack: async (path, pattern) => {
    try {
      await invoke('lfs_untrack', { path, pattern });
      await get().loadLfsStatus(path);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadSubtrees: async (path) => {
    try {
      const subtrees = await invoke<SubtreeInfo[]>('get_subtrees', { path });
      set({ subtrees });
    } catch (e) {
      console.error('Failed to load subtrees:', e);
    }
  },

  addSubtree: async (path, prefix, remote, branch) => {
    try {
      await invoke('add_subtree', { path, prefix, remote, branch });
      await get().loadSubtrees(path);
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
