import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';
import { defaultShortcuts } from '../lib/shortcuts';

// Serializable shortcut definition
export interface ShortcutDef {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

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
  
  // Shortcuts
  shortcuts: Record<string, ShortcutDef>;
  setShortcut: (id: string, def: ShortcutDef) => void;
  resetShortcuts: () => void;
  
  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

// Helper to extract defaults
const getDefaultShortcuts = () => {
  const defaults: Record<string, ShortcutDef> = {};
  for (const [id, config] of Object.entries(defaultShortcuts)) {
    // Cast to any to access optional properties safely, or strict check
    const c = config as any;
    defaults[id] = {
      key: c.key,
      ctrlKey: !!c.ctrlKey,
      altKey: !!c.altKey,
      shiftKey: !!c.shiftKey,
      metaKey: !!c.metaKey,
    };
  }
  return defaults;
};

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
      
      shortcuts: getDefaultShortcuts(),

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
      
      setShortcut: (id, def) => set((state) => ({
        shortcuts: { ...state.shortcuts, [id]: def }
      })),
      
      resetShortcuts: () => set({ shortcuts: getDefaultShortcuts() }),
    }),
    {
      name: 'gat-settings',
    }
  )
);
