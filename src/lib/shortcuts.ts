/**
 * Global keyboard shortcuts for the application
 */

export interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  enabled?: () => boolean;
}

type ShortcutMap = Map<string, ShortcutConfig>;

class ShortcutManager {
  private shortcuts: ShortcutMap = new Map();
  private isEnabled = true;

  /**
   * Check if event matches a shortcut config
   */
  private matches(event: KeyboardEvent, config: ShortcutConfig): boolean {
    return isShortcutMatch(event, config);
  }



  /**
   * Register a new shortcut
   */
  register(config: ShortcutConfig): () => void {
    const key = `${config.ctrlKey ? 'ctrl+' : ''}${config.altKey ? 'alt+' : ''}${config.shiftKey ? 'shift+' : ''}${config.metaKey ? 'meta+' : ''}${config.key}`;
    this.shortcuts.set(key, config);

    // Return unregister function
    return () => this.shortcuts.delete(key);
  }

  /**
   * Register multiple shortcuts
   */
  registerAll(configs: ShortcutConfig[]): () => void {
    const unsubscribers = configs.map((config) => this.register(config));
    return () => unsubscribers.forEach((fn) => fn());
  }

  /**
   * Handle keyboard event
   */
  handleEvent(event: KeyboardEvent): boolean {
    if (!this.isEnabled) return false;

    // Ignore if user is typing in an input
    const target = event.target as HTMLElement;
    const isInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (isInputField) return false;

    for (const [, config] of this.shortcuts) {
      if (this.matches(event, config)) {
        if (config.enabled === undefined || config.enabled()) {
          event.preventDefault();
          event.stopPropagation();
          config.action();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Enable shortcuts
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable shortcuts
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }
}

export function isShortcutMatch(event: KeyboardEvent, config: Pick<ShortcutConfig, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): boolean {
    const key = event.key.toLowerCase();
    const hasCtrl = config.ctrlKey ?? false;
    const hasAlt = config.altKey ?? false;
    const hasShift = config.shiftKey ?? false;
    const hasMeta = config.metaKey ?? false;

    return (
      key === config.key.toLowerCase() &&
      event.ctrlKey === hasCtrl &&
      event.altKey === hasAlt &&
      event.shiftKey === hasShift &&
      event.metaKey === hasMeta
    );
}

// Global singleton
export const shortcutManager = new ShortcutManager();

// Keyboard event listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => shortcutManager.handleEvent(e));
}

/**
 * Format shortcut key for display
 */
export function formatShortcut(config: Pick<ShortcutConfig, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
  const parts: string[] = [];

  if (config.ctrlKey) parts.push('⌘');
  if (config.altKey) parts.push('⌥');
  if (config.shiftKey) parts.push('⇧');

  const key = config.key.toUpperCase();
  // Special keys
  const specialKeys: Record<string, string> = {
    ' ': 'Space',
    'ENTER': '↩',
    'ESC': '⎋',
    'BACKSPACE': '⌫',
    'DELETE': '⌦',
    'TAB': '⇥',
  };

  parts.push(specialKeys[key] || key);
  return parts.join(' ');
}

/**
 * Default shortcuts for common Git operations
 */
export const defaultShortcuts = {
  // Commit
  commit: { key: 'Enter', ctrlKey: true, description: '提交' },
  // Stage
  stageAll: { key: 'a', ctrlKey: true, shiftKey: true, description: '全部暂存' },
  // Unstage
  unstageAll: { key: 'a', ctrlKey: true, altKey: true, description: '全部取消暂存' },
  // Pull
  pull: { key: 'p', ctrlKey: true, description: '拉取' },
  // Push
  push: { key: 'p', ctrlKey: true, shiftKey: true, description: '推送' },
  // Refresh
  refresh: { key: 'r', ctrlKey: true, description: '刷新' },
  // Stash
  stash: { key: 's', ctrlKey: true, description: '贮存' },
  // Switch to history view
  historyView: { key: 'h', ctrlKey: true, description: '历史视图' },
  // Switch to changes view
  changesView: { key: '1', ctrlKey: true, description: '变更视图' },
  // Find
  find: { key: 'f', ctrlKey: true, description: '搜索' },
  // Command palette
  commandPalette: { key: 'k', ctrlKey: true, description: '命令面板' },
};
