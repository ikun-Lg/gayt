import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { AlertTriangle, CheckCircle, XCircle, FileText, ArrowLeft, ArrowRight, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ConflictResolution } from '../types';

interface ConflictPanelProps {
  repoPath: string;
  onResolve?: () => void;
}

export function ConflictPanel({ repoPath, onResolve }: ConflictPanelProps) {
  const { mergeState, resolveConflict, getConflictDiff, abortMerge, completeMerge, refreshStatus } = useRepoStore();
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [conflictContent, setConflictContent] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSelectConflict = async (path: string) => {
    if (selectedConflict === path) {
      setSelectedConflict(null);
      setConflictContent(null);
    } else {
      setSelectedConflict(path);
      try {
        const content = await getConflictDiff(repoPath, path);
        setConflictContent(content);
      } catch (e) {
        setConflictContent('Error loading conflict content');
      }
    }
  };

  const handleResolve = async (filePath: string, version: ConflictResolution) => {
    setIsResolving(filePath);
    try {
      await resolveConflict(repoPath, filePath, version);

      // Refresh status and clear selection if this conflict is resolved
      await refreshStatus(repoPath);

      // Check if this conflict still exists
      if (mergeState?.conflictedFiles.find(c => c.path === filePath)) {
        // Still has conflicts, refresh content
        const content = await getConflictDiff(repoPath, filePath);
        setConflictContent(content);
      } else {
        // Conflict resolved
        setSelectedConflict(null);
        setConflictContent(null);
      }

      // If all conflicts resolved, call onResolve
      const newState = await new Promise<any>((resolve) => {
        // Small delay to let store update
        setTimeout(async () => {
          const state = useRepoStore.getState().mergeState;
          resolve(state);
        }, 100);
      });

      if (!newState?.isMergeInProgress) {
        onResolve?.();
      }
    } catch (e) {
      console.error('Failed to resolve conflict:', e);
    } finally {
      setIsResolving(null);
    }
  };

  const handleAbort = async () => {
    if (confirm('确定要中止合并吗？所有未提交的更改将被保留。')) {
      await abortMerge(repoPath);
      setSelectedConflict(null);
      setConflictContent(null);
    }
  };

  const handleComplete = async () => {
    if (!mergeState?.isMergeInProgress) return;

    const message = prompt('请输入合并提交消息:', 'Merge branch');
    if (message) {
      await completeMerge(repoPath, message);
      setSelectedConflict(null);
      setConflictContent(null);
      onResolve?.();
    }
  };

  const copyContent = () => {
    if (conflictContent) {
      navigator.clipboard.writeText(conflictContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mergeState?.isMergeInProgress) {
    return null;
  }

  const hasConflicts = mergeState.conflictCount > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-destructive/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasConflicts ? (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {hasConflicts ? '合并冲突' : '合并待完成'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {hasConflicts
                  ? `发现 ${mergeState.conflictCount} 个冲突文件需要解决`
                  : '所有冲突已解决，可以完成合并'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasConflicts && (
              <Badge variant="outline" className="h-7 gap-1.5 px-3 bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                {mergeState.conflictCount} 个冲突
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAbort}
              className="h-8"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              中止合并
            </Button>
            {!hasConflicts && (
              <Button
                size="sm"
                onClick={handleComplete}
                className="h-8 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                完成合并
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Conflict List */}
        <div className={`flex flex-col bg-card/30 transition-all duration-300 ${
          selectedConflict ? 'w-1/3 border-r border-border/40' : 'w-full'
        }`}>
          <div className="p-4 border-b border-border/40">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              冲突文件
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {mergeState.conflictedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CheckCircle className="w-12 h-12 mb-3 text-green-500" />
                <p>所有冲突已解决</p>
              </div>
            ) : (
              <div className="space-y-1">
                {mergeState.conflictedFiles.map((conflict) => (
                  <div
                    key={conflict.path}
                    onClick={() => handleSelectConflict(conflict.path)}
                    className={`group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedConflict === conflict.path
                        ? 'bg-destructive/10 border border-destructive/30'
                        : 'hover:bg-accent/50 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5">
                      <FileText className={`w-4 h-4 ${
                        selectedConflict === conflict.path
                          ? 'text-destructive'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        selectedConflict === conflict.path
                          ? 'text-destructive'
                          : 'text-foreground'
                      }`}>
                        {conflict.path}
                      </div>
                      {conflict.conflictMarkers && (
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                            冲突标记
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {selectedConflict === conflict.path ? (
                        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conflict Detail */}
        {selectedConflict && (
          <div className="w-2/3 flex flex-col bg-background">
            <div className="shrink-0 border-b border-border/40 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{selectedConflict}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyContent}
                  className="h-7 px-2"
                  title="复制内容"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Conflict Actions */}
            <div className="shrink-0 border-b border-border/40 px-4 py-3 bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground mb-2">选择要保留的版本:</div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResolve(selectedConflict, 'current')}
                  disabled={isResolving === selectedConflict}
                  className="flex-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  当前版本
                  <span className="text-[10px] opacity-60 ml-1">(ours)</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResolve(selectedConflict, 'incoming')}
                  disabled={isResolving === selectedConflict}
                  className="flex-1"
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                  传入版本
                  <span className="text-[10px] opacity-60 ml-1">(theirs)</span>
                </Button>
              </div>
            </div>

            {/* Conflict Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-muted/10">
              {conflictContent ? (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/90">
                  {conflictContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  加载中...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
