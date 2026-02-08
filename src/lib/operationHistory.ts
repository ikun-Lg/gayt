/**
 * Git Operation History for undo/redo functionality
 */

export type OperationType =
  | 'stage'
  | 'unstage'
  | 'commit'
  | 'stash'
  | 'push'
  | 'pull'
  | 'merge'
  | 'rebase'
  | 'branch'
  | 'discard'
  | 'revert'
  | 'stage-all'
  | 'unstage-all';

export interface GitOperation {
  id: string;
  type: OperationType;
  description: string;
  timestamp: number;
  repoPath: string;
  // Data needed to undo this operation
  undoData?: unknown;
  // Whether this operation can be undone
  undoable: boolean;
}

interface HistoryState {
  operations: GitOperation[];
  currentIndex: number; // Points to the last executed operation
}

class OperationHistoryManager {
  private history: Map<string, HistoryState> = new Map();
  private readonly maxHistorySize = 50;

  /**
   * Get history state for a repository
   */
  private getState(repoPath: string): HistoryState {
    if (!this.history.has(repoPath)) {
      this.history.set(repoPath, { operations: [], currentIndex: -1 });
    }
    return this.history.get(repoPath)!;
  }

  /**
   * Record a new operation
   */
  record(operation: Omit<GitOperation, 'id' | 'timestamp'>): string {
    const state = this.getState(operation.repoPath);
    const id = `${operation.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const newOp: GitOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
    };

    // If we're not at the end of history, remove all operations after current
    const newOperations = state.operations.slice(0, state.currentIndex + 1);

    // Add new operation
    newOperations.push(newOp);

    // Limit history size
    if (newOperations.length > this.maxHistorySize) {
      newOperations.shift();
    }

    this.history.set(operation.repoPath, {
      operations: newOperations,
      currentIndex: newOperations.length - 1,
    });

    return id;
  }

  /**
   * Get history for a repository
   */
  getHistory(repoPath: string): GitOperation[] {
    const state = this.getState(repoPath);
    return [...state.operations];
  }

  /**
   * Get the last operation that can be undone
   */
  getLastUndoable(repoPath: string): GitOperation | null {
    const state = this.getState(repoPath);
    for (let i = state.currentIndex; i >= 0; i--) {
      const op = state.operations[i];
      if (op.undoable) return op;
    }
    return null;
  }

  /**
   * Get the next operation that can be redone
   */
  getLastRedoable(repoPath: string): GitOperation | null {
    const state = this.getState(repoPath);
    for (let i = state.currentIndex + 1; i < state.operations.length; i++) {
      const op = state.operations[i];
      if (op.undoable) return op;
    }
    return null;
  }

  /**
   * Check if undo is available
   */
  canUndo(repoPath: string): boolean {
    return this.getLastUndoable(repoPath) !== null;
  }

  /**
   * Check if redo is available
   */
  canRedo(repoPath: string): boolean {
    return this.getLastRedoable(repoPath) !== null;
  }

  /**
   * Clear history for a repository
   */
  clear(repoPath: string): void {
    this.history.delete(repoPath);
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.history.clear();
  }

  /**
   * Move history pointer back and return operation to undo
   */
  performUndo(repoPath: string): GitOperation | null {
    const state = this.getState(repoPath);
    if (state.currentIndex >= 0) {
      const op = state.operations[state.currentIndex];
      if (op.undoable) {
        state.currentIndex--;
        return op;
      }
    }
    return null;
  }

  /**
   * Move history pointer forward and return operation to redo
   */
  performRedo(repoPath: string): GitOperation | null {
    const state = this.getState(repoPath);
    if (state.currentIndex < state.operations.length - 1) {
      state.currentIndex++;
      return state.operations[state.currentIndex];
    }
    return null;
  }

  /**
   * Get history statistics
   */
  getStats(repoPath: string): { total: number; undoable: number; currentIndex: number } {
    const state = this.getState(repoPath);
    const undoable = state.operations.filter((op: GitOperation) => op.undoable).length;
    return { total: state.operations.length, undoable, currentIndex: state.currentIndex };
  }
}

// Global singleton
export const operationHistory = new OperationHistoryManager();
