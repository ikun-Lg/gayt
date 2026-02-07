import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';

interface SettingsStore extends Settings {
  // Git username and password/token
  gitUsername: string | null;
  gitPassword: string | null;
  setGitUsername: (username: string | null) => void;
  setGitPassword: (password: string | null) => void;
  // Existing
  setWorkDir: (dir: string | null) => void;
  setAiProvider: (provider: 'heuristic' | 'deepseek' | 'glm') => void;
  setDeepseekApiKey: (key: string | null) => void;
  setGlmApiKey: (key: string | null) => void;
  setCommitLanguage: (lang: 'zh' | 'en') => void;
  setCommitFormat: (format: 'conventional' | 'custom') => void;
  setCustomPrompt: (prompt: string | null) => void;
  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Initial state
      workDir: null,
      aiProvider: 'heuristic',
      deepseekApiKey: null,
      glmApiKey: null,
      commitLanguage: 'zh',
      commitFormat: 'conventional',
      customPrompt: null,
      gitUsername: null,
      gitPassword: null,
      sidebarWidth: 320, // Default width

      // Actions
      setWorkDir: (dir) => set({ workDir: dir }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setDeepseekApiKey: (key) => set({ deepseekApiKey: key }),
      setGlmApiKey: (key) => set({ glmApiKey: key }),
      setCommitLanguage: (lang) => set({ commitLanguage: lang }),
      setCommitFormat: (format) => set({ commitFormat: format }),
      setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
      setGitUsername: (username) => set({ gitUsername: username }),
      setGitPassword: (password) => set({ gitPassword: password }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
    }),
    {
      name: 'gayt-settings',
    }
  )
);
