import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { PullRequest, Issue, CreatePullRequest, CreateIssue, CommitStatus } from '../types';
import { useSettingsStore } from './settingsStore';

interface ProviderStore {
  pullRequests: PullRequest[];
  issues: Issue[];
  commitStatuses: Record<string, CommitStatus[]>;
  isLoading: boolean;
  error: string | null;

  loadPullRequests: (path: string) => Promise<void>;
  loadIssues: (path: string) => Promise<void>;
  loadCommitStatus: (path: string, sha: string) => Promise<void>;
  fetchJobLogs: (path: string, jobId: string) => Promise<string>;
  createPullRequest: (path: string, pr: CreatePullRequest) => Promise<void>;
  createIssue: (path: string, issue: CreateIssue) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const getProviderConfig = async () => {
  const settings = useSettingsStore.getState();
  const { useRepoStore } = await import('./repoStore');
  const repoStore = useRepoStore.getState();
  const remotes = repoStore.remotes;
  const origin = remotes.find(r => r.name === 'origin');
  
  let token = '';
  let domain: string | undefined = undefined;

  if (origin && origin.url) {
      if (origin.url.includes('gitlab')) {
          token = settings.gitlabToken || '';
          if (settings.gitlabUrl) {
               try {
                   const url = new URL(settings.gitlabUrl);
                   domain = url.host;
               } catch {}
          }
      } else {
          token = settings.githubToken || '';
      }
  } else {
      token = settings.githubToken || '';
  }
  return { token, domain };
};

export const useProviderStore = create<ProviderStore>((set, get) => ({
  pullRequests: [],
  issues: [],
  commitStatuses: {},
  isLoading: false,
  error: null,

  loadPullRequests: async (path: string) => {
    set({ isLoading: true, error: null });
    const { token, domain } = await getProviderConfig();

    try {
      const prs = await invoke<PullRequest[]>('fetch_pr_list', { path, token, domain });
      set({ pullRequests: prs, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadIssues: async (path: string) => {
    set({ isLoading: true, error: null });
    const { token, domain } = await getProviderConfig();

    try {
      const issues = await invoke<Issue[]>('fetch_issue_list', { path, token, domain });
      set({ issues, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadCommitStatus: async (path: string, sha: string) => {
    const { token, domain } = await getProviderConfig();
    if (!token) return;

    try {
      const statuses = await invoke<CommitStatus[]>('fetch_commit_status', { path, token, domain, sha });
      set(state => ({
        commitStatuses: {
          ...state.commitStatuses,
          [sha]: statuses
        }
      }));
    } catch (e) {
      console.error(`Failed to load commit status for ${sha}:`, e);
    }
  },

  fetchJobLogs: async (path: string, jobId: string) => {
    const { token, domain } = await getProviderConfig();
    try {
      return await invoke<string>('fetch_job_logs', { path, token, domain, jobId });
    } catch (e) {
      console.error(`Failed to fetch job logs for ${jobId}:`, e);
      throw e;
    }
  },

  createPullRequest: async (path: string, pr: CreatePullRequest) => {
    set({ isLoading: true, error: null });
    const { token, domain } = await getProviderConfig();

    try {
      await invoke<PullRequest>('create_pr', { path, token, domain, pr });
      await get().loadPullRequests(path);
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  createIssue: async (path: string, issue: CreateIssue) => {
    set({ isLoading: true, error: null });
    const { token, domain } = await getProviderConfig();

    try {
      await invoke<Issue>('create_issue', { path, token, domain, issue });
      await get().loadIssues(path);
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ pullRequests: [], issues: [], commitStatuses: {}, error: null, isLoading: false }),
}));
