
import { useRepoStore } from '../store/repoStore';
import { operationHistory, GitOperation } from '../lib/operationHistory';
import { Button } from './ui/Button';
import { RotateCcw, Clock, History, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';

interface OperationLogPanelProps {
  repoPath: string;
  onClose: () => void;
}

export function OperationLogPanel({ repoPath, onClose }: OperationLogPanelProps) {
  const { historyChangeCount, undoLastOperation, redoLastOperation } = useRepoStore();
  const [operations, setOperations] = useState<GitOperation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const stats = operationHistory.getStats(repoPath);
    setOperations(operationHistory.getHistory(repoPath));
    setCurrentIndex(stats.currentIndex);
  }, [repoPath, historyChangeCount]);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < operations.length - 1;

  const handleUndo = async () => {
    if (canUndo) {
      await undoLastOperation(repoPath);
    }
  };

  const handleRedo = async () => {
    if (canRedo) {
      await redoLastOperation(repoPath);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm shadow-xl w-80 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <div className="flex items-center gap-2">
           <History className="w-4 h-4 text-primary" />
           <h3 className="font-semibold text-sm">操作历史</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canUndo}
            onClick={handleUndo}
            title="撤销 (Undo)"
            className="h-7 w-7 p-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canRedo}
            onClick={handleRedo}
            title="重做 (Redo)"
            className="h-7 w-7 p-0"
          >
            <RotateCcw className="w-3.5 h-3.5 scale-x-[-1]" />
          </Button>
          <div className="w-px h-3 bg-border/50 mx-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            title="关闭"
            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {operations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 text-xs">
            <Clock className="w-8 h-8 mb-2 opacity-20" />
            暂无操作记录
          </div>
        ) : (
          operations.slice().reverse().map((op, index) => {
            // Calculate actual index in original array
            const originalIndex = operations.length - 1 - index;
            const isUndone = originalIndex > currentIndex;
            const isLatest = originalIndex === currentIndex;

            return (
              <div
                key={op.id}
                className={cn(
                  "relative pl-4 pr-3 py-2.5 rounded-lg border text-sm transition-all",
                  isUndone 
                    ? "bg-muted/30 text-muted-foreground border-transparent opacity-60" 
                    : "bg-card/50 border-border/40 shadow-sm",
                  isLatest && "ring-1 ring-primary/30 bg-primary/5 border-primary/20"
                )}
              >
                {/* Timeline connector */}
                <div className={cn(
                  "absolute left-[6px] top-0 bottom-0 w-px",
                  index === operations.length - 1 ? "bottom-1/2" : "",
                  index === 0 ? "top-1/2" : "",
                  "bg-border/40"
                )} />
                
                {/* Dot */}
                <div className={cn(
                  "absolute left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2",
                  isUndone 
                    ? "border-muted-foreground/30 bg-background" 
                    : isLatest 
                      ? "border-primary bg-primary" 
                      : "border-primary/40 bg-background"
                )} />

                <div className="flex flex-col gap-0.5 ml-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("font-medium", isLatest && "text-primary")}>
                      {op.description}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {formatTime(op.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="uppercase tracking-wider opacity-70">{op.type}</span>
                    {isUndone && <span>已撤销</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
