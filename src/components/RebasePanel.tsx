import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { GitBranch, Play, SkipForward, X, Edit2, Trash2, Check, Loader2, GripVertical } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { RebaseTodo, RebaseCommand, CommitInfo } from '../types';
import { cn } from '../lib/utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RebasePanelProps {
  repoPath: string;
  commits: CommitInfo[];
  onClose: () => void;
  onComplete: () => void;
}

const COMMAND_LABELS: Record<RebaseCommand, string> = {
  pick: '保留',
  reword: '改写',
  edit: '编辑',
  squash: '合并',
  fixup: '修复',
  drop: '丢弃',
};

const COMMAND_COLORS: Record<RebaseCommand, string> = {
  pick: 'text-green-600 bg-green-50 dark:bg-green-950/20',
  reword: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
  edit: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20',
  squash: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20',
  fixup: 'text-pink-600 bg-pink-50 dark:bg-pink-950/20',
  drop: 'text-red-600 bg-red-50 dark:bg-red-950/20',
};

interface SortableTodoItemProps {
  todo: RebaseTodo;
  index: number;
  isRebaseInProgress: boolean | undefined;
  cycleCommand: (id: string) => void;
  removeTodo: (id: string) => void;
  setEditMessage: (data: { id: string; message: string }) => void;
}

function SortableTodoItem({ todo, index, isRebaseInProgress, cycleCommand, removeTodo, setEditMessage }: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !!isRebaseInProgress,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border transition-all",
        "bg-card/30 border-border/40 hover:border-border/60",
        todo.command === 'drop' && "opacity-50",
        isDragging && "bg-accent/10 ring-2 ring-primary/20",
        !isRebaseInProgress && "cursor-default" // Item itself not draggable, handle is
      )}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded text-xs font-bold -ml-1",
          !isRebaseInProgress ? "text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted/50" : "text-muted-foreground/50 cursor-not-allowed"
        )}
        {...attributes}
        {...listeners}
      >
        {!isRebaseInProgress ? <GripVertical className="w-3.5 h-3.5" /> : <span className="text-[10px]">{index + 1}</span>}
      </div>

      {/* Command badge */}
      <button
        onClick={() => !isRebaseInProgress && cycleCommand(todo.id)}
        disabled={isRebaseInProgress}
        className={cn(
          "px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-all",
          COMMAND_COLORS[todo.command],
          !isRebaseInProgress && "hover:scale-105"
        )}
      >
        {COMMAND_LABELS[todo.command]}
      </button>

      {/* Commit info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {todo.commit.message.split('\n')[0]}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">
            {todo.commit.shortId}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {todo.commit.author}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isRebaseInProgress && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {todo.command === 'reword' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditMessage({ id: todo.id, message: todo.commit.message })}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {todo.command !== 'drop' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-500 hover:text-red-600"
              onClick={() => removeTodo(todo.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function RebasePanel({ repoPath, commits, onClose, onComplete }: RebasePanelProps) {
  const { rebaseState, startInteractiveRebase, continueRebase, skipRebase, abortRebase, amendRebaseCommit, getRebaseState } = useRepoStore();
  const [todos, setTodos] = useState<RebaseTodo[]>([]);
  const [baseCommit, setBaseCommit] = useState<string>('');
  const [isRebasing, setIsRebasing] = useState(false);
  const [editMessage, setEditMessage] = useState<{ id: string; message: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Initialize todos from commits
    const initialTodos: RebaseTodo[] = commits.map((commit) => ({
      id: commit.id,
      command: 'pick',
      commit,
    }));
    setTodos(initialTodos);
    if (commits.length > 0) {
      // Set base commit to parent of last commit
      setBaseCommit(commits[commits.length - 1].parents[0] || 'HEAD~' + commits.length);
    }
  }, [commits]);

  useEffect(() => {
    // Check rebase state periodically
    const interval = setInterval(() => {
      if (rebaseState?.isRebaseInProgress) {
        getRebaseState(repoPath);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rebaseState?.isRebaseInProgress, repoPath, getRebaseState]);

  const handleStartRebase = async () => {
    if (todos.length === 0) return;

    setIsRebasing(true);
    try {
      await startInteractiveRebase(repoPath, baseCommit, todos);
      if (rebaseState?.isRebaseInProgress === false) {
        onComplete();
        onClose();
      }
    } catch (e) {
      console.error('Rebase failed:', e);
    } finally {
      setIsRebasing(false);
    }
  };

  const handleContinue = async () => {
    setIsRebasing(true);
    try {
      await continueRebase(repoPath);
      if (rebaseState?.isRebaseInProgress === false) {
        onComplete();
        onClose();
      }
    } catch (e) {
      console.error('Continue rebase failed:', e);
    } finally {
      setIsRebasing(false);
    }
  };

  const handleSkip = async () => {
    setIsRebasing(true);
    try {
      await skipRebase(repoPath);
    } catch (e) {
      console.error('Skip rebase failed:', e);
    } finally {
      setIsRebasing(false);
    }
  };

  const handleAbort = async () => {
    if (confirm('确定要中止 Rebase 吗？所有更改将被丢弃。')) {
      setIsRebasing(true);
      try {
        await abortRebase(repoPath);
        onClose();
      } catch (e) {
        console.error('Abort rebase failed:', e);
      } finally {
        setIsRebasing(false);
      }
    }
  };

  const handleSaveMessage = async () => {
    if (!editMessage) return;

    setIsRebasing(true);
    try {
      await amendRebaseCommit(repoPath, editMessage.message);
      setEditMessage(null);
      await handleContinue();
    } catch (e) {
      console.error('Save message failed:', e);
    } finally {
      setIsRebasing(false);
    }
  };

  const cycleCommand = (id: string) => {
    const commands: RebaseCommand[] = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'];
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const currentIndex = commands.indexOf(todo.command);
    const nextIndex = (currentIndex + 1) % commands.length;
    const newCommand = commands[nextIndex];

    setTodos(todos.map(t => t.id === id ? { ...t, command: newCommand } : t));
  };

  const removeTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, command: 'drop' } : t));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTodos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const activeTodos = todos.filter(t => t.command !== 'drop');
  const droppedCount = todos.filter(t => t.command === 'drop').length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-purple-500/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
              <GitBranch className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">交互式 Rebase</h2>
              <p className="text-xs text-muted-foreground">
                {rebaseState?.isRebaseInProgress
                  ? `Rebase 进行中 (${rebaseState.currentStep}/${rebaseState.totalSteps})`
                  : `拖拽排序 ${activeTodos.length} 个提交，点击更改操作`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {droppedCount > 0 && (
              <Badge variant="outline" className="h-7 gap-1.5 px-3 bg-red-500/10 text-red-600 border-red-500/20">
                <Trash2 className="w-3.5 h-3.5" />
                {droppedCount} 个丢弃
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={onClose} disabled={isRebasing}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Base commit input */}
        {!rebaseState?.isRebaseInProgress && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">基准提交:</label>
            <input
              type="text"
              value={baseCommit}
              onChange={(e) => setBaseCommit(e.target.value)}
              placeholder="HEAD~N or commit hash"
              className="flex-1 h-8 px-3 text-sm bg-background border border-border/60 rounded-md focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500/50 transition-all outline-none"
            />
            <div className="text-xs text-muted-foreground">
              {activeTodos.length} 个提交将重新应用
            </div>
          </div>
        )}
      </div>

      {/* Rebase in progress controls */}
      {rebaseState?.isRebaseInProgress && (
        <div className="shrink-0 border-b border-border/40 px-6 py-4 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              <div>
                <p className="text-sm font-medium text-foreground">Rebase 进行中</p>
                <p className="text-xs text-muted-foreground">
                  正在应用: {rebaseState.currentCommit ? rebaseState.currentCommit.slice(0, 7) : '...'}
                </p>
              </div>
            </div>

            {rebaseState.currentStep === rebaseState.totalSteps ? (
              <Button size="sm" onClick={handleContinue} disabled={isRebasing}>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                完成 Rebase
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSkip} disabled={isRebasing}>
                  <SkipForward className="w-3.5 h-3.5 mr-1.5" />
                  跳过
                </Button>
                <Button size="sm" onClick={handleContinue} disabled={isRebasing}>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  继续
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="max-w-3xl mx-auto space-y-2">
                {todos.map((todo, index) => (
                    <SortableTodoItem
                        key={todo.id}
                        todo={todo}
                        index={index}
                        isRebaseInProgress={rebaseState?.isRebaseInProgress}
                        cycleCommand={cycleCommand}
                        removeTodo={removeTodo}
                        setEditMessage={setEditMessage}
                    />
                ))}
                </div>
            </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      {!rebaseState?.isRebaseInProgress && (
        <div className="shrink-0 border-t border-border/40 px-6 py-4 bg-card/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-green-500" />
                保留提交
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-blue-500" />
                改写消息
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-red-500" />
                丢弃提交
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAbort}
                disabled={isRebasing}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleStartRebase}
                disabled={isRebasing || activeTodos.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isRebasing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                )}
                开始 Rebase
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit message dialog */}
      {editMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-4 border-b border-border/40">
              <h3 className="text-sm font-semibold text-foreground">编辑提交消息</h3>
            </div>
            <div className="p-4">
              <textarea
                value={editMessage.message}
                onChange={(e) => setEditMessage({ ...editMessage, message: e.target.value })}
                className="w-full h-32 p-3 text-sm bg-background border border-border/60 rounded-lg focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500/50 transition-all outline-none resize-none"
              />
            </div>
            <div className="p-4 border-t border-border/40 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditMessage(null)}>
                取消
              </Button>
              <Button size="sm" onClick={handleSaveMessage} disabled={isRebasing}>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                保存并继续
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
