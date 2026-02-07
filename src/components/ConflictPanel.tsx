import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { AlertTriangle, CheckCircle, XCircle, FileText, ArrowLeft, ArrowRight, Copy, Check, Eye, Code, Save } from 'lucide-react';
import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ConflictResolution } from '../types';
import { cn } from '../lib/utils';

interface ConflictPanelProps {
  repoPath: string;
  onResolve?: () => void;
}

type ViewMode = 'preview' | 'editor';

interface ParsedConflict {
  markerStart: number;
  markerSeparator: number;
  markerEnd: number;
  current: string;
  incoming: string;
  ancestor?: string;
}

export function ConflictPanel({ repoPath, onResolve }: ConflictPanelProps) {
  const { mergeState, resolveConflict, getConflictDiff, abortMerge, completeMerge, refreshStatus } = useRepoStore();
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [conflictContent, setConflictContent] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLTextAreaElement>(null);

  const parsedConflict = conflictContent ? parseConflictMarkers(conflictContent) : null;

  const handleSelectConflict = async (path: string) => {
    if (selectedConflict === path) {
      setSelectedConflict(null);
      setConflictContent(null);
      setEditedContent('');
      setViewMode('preview');
    } else {
      setSelectedConflict(path);
      setViewMode('preview');
      try {
        const content = await getConflictDiff(repoPath, path);
        setConflictContent(content);
        setEditedContent(content);
      } catch (e) {
        setConflictContent('Error loading conflict content');
        setEditedContent('Error loading conflict content');
      }
    }
  };

  const handleResolve = async (filePath: string, version: ConflictResolution) => {
    setIsResolving(filePath);
    try {
      await resolveConflict(repoPath, filePath, version);
      await refreshStatus(repoPath);

      // Check if this conflict still exists
      const state = useRepoStore.getState().mergeState;
      const stillConflicted = state?.conflictedFiles.find(c => c.path === filePath);

      if (!stillConflicted) {
        // Conflict resolved, move to next
        const nextConflict = state?.conflictedFiles[0];
        if (nextConflict) {
          setSelectedConflict(nextConflict.path);
          const content = await getConflictDiff(repoPath, nextConflict.path);
          setConflictContent(content);
          setEditedContent(content);
        } else {
          setSelectedConflict(null);
          setConflictContent(null);
          setEditedContent('');
        }
      } else {
        const content = await getConflictDiff(repoPath, filePath);
        setConflictContent(content);
        setEditedContent(content);
      }

      // If all conflicts resolved, call onResolve
      if (!state?.isMergeInProgress || state.conflictCount === 0) {
        onResolve?.();
      }
    } catch (e) {
      console.error('Failed to resolve conflict:', e);
    } finally {
      setIsResolving(null);
    }
  };

  const handleManualResolve = async () => {
    if (!selectedConflict) return;

    setIsSaving(true);
    try {
      // Write the edited content to the file
      await invoke('write_conflict_file', {
        path: repoPath,
        filePath: selectedConflict,
        content: editedContent,
      });

      // Then mark as resolved
      await resolveConflict(repoPath, selectedConflict, 'manual');
      await refreshStatus(repoPath);

      const state = useRepoStore.getState().mergeState;
      const nextConflict = state?.conflictedFiles[0];

      if (nextConflict) {
        setSelectedConflict(nextConflict.path);
        const content = await getConflictDiff(repoPath, nextConflict.path);
        setConflictContent(content);
        setEditedContent(content);
      } else {
        setSelectedConflict(null);
        setConflictContent(null);
        setEditedContent('');
      }

      if (!state?.isMergeInProgress || state.conflictCount === 0) {
        onResolve?.();
      }
    } catch (e) {
      console.error('Failed to save conflict resolution:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAbort = async () => {
    if (confirm('确定要中止合并吗？所有未提交的更改将被保留。')) {
      await abortMerge(repoPath);
      setSelectedConflict(null);
      setConflictContent(null);
      setEditedContent('');
    }
  };

  const handleComplete = async () => {
    if (!mergeState?.isMergeInProgress) return;

    const message = prompt('请输入合并提交消息:', 'Merge branch');
    if (message) {
      await completeMerge(repoPath, message);
      setSelectedConflict(null);
      setConflictContent(null);
      setEditedContent('');
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

  const selectVersion = (version: 'current' | 'incoming' | 'ancestor') => {
    if (!parsedConflict) return;

    let content = '';
    switch (version) {
      case 'current':
        content = parsedConflict.current;
        break;
      case 'incoming':
        content = parsedConflict.incoming;
        break;
      case 'ancestor':
        content = parsedConflict.ancestor || '';
        break;
    }

    setEditedContent(content);
    setViewMode('editor');
  };

  const combineVersions = () => {
    if (!parsedConflict) return;

    // Show a prompt asking for combination preference
    const choice = prompt(
      '选择合并方式：\n1 - 当前优先（传入作为后备）\n2 - 传入优先（当前作为后备）\n3 - 仅保留共同部分\n\n请输入数字 1-3：'
    );

    let combined = '';
    switch (choice) {
      case '1':
        combined = parsedConflict.current || parsedConflict.incoming;
        break;
      case '2':
        combined = parsedConflict.incoming || parsedConflict.current;
        break;
      case '3':
        // Try to find common lines
        const currentLines = parsedConflict.current.split('\n');
        const incomingLines = parsedConflict.incoming.split('\n');
        combined = currentLines.filter(line => incomingLines.includes(line)).join('\n');
        break;
      default:
        return;
    }

    setEditedContent(combined);
    setViewMode('editor');
  };

  // Parse conflict markers from content
  function parseConflictMarkers(content: string): ParsedConflict | null {
    const lines = content.split('\n');
    let startIdx = -1;
    let sepIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('<<<<<<<')) {
        startIdx = i;
      } else if (lines[i].startsWith('=======') && startIdx >= 0) {
        sepIdx = i;
      } else if (lines[i].startsWith('>>>>>>>') && sepIdx >= 0) {
        endIdx = i;
        break;
      }
    }

    if (startIdx >= 0 && sepIdx >= 0 && endIdx >= 0) {
      return {
        markerStart: startIdx,
        markerSeparator: sepIdx,
        markerEnd: endIdx,
        current: lines.slice(startIdx + 1, sepIdx).join('\n'),
        incoming: lines.slice(sepIdx + 1, endIdx).join('\n'),
      };
    }

    return null;
  }

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
        <div className={cn(
          "flex flex-col bg-card/30 transition-all duration-300 border-r border-border/40",
          selectedConflict ? "w-80" : "w-full"
        )}>
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
                {mergeState.conflictedFiles.map((conflict, idx) => (
                  <div
                    key={conflict.path}
                    onClick={() => handleSelectConflict(conflict.path)}
                    className={cn(
                      "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
                      selectedConflict === conflict.path
                        ? "bg-destructive/10 border border-destructive/30"
                        : "hover:bg-accent/50 border border-transparent"
                    )}
                  >
                    <div className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium truncate",
                        selectedConflict === conflict.path
                          ? "text-destructive"
                          : "text-foreground"
                      )}>
                        {conflict.path.split('/').pop()}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conflict Detail */}
        {selectedConflict && (
          <div className="flex-1 flex flex-col bg-background">
            {/* Detail Header */}
            <div className="shrink-0 border-b border-border/40 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{selectedConflict}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('preview')}
                  className="h-7 px-2 text-xs"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  预览
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'editor' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('editor')}
                  className="h-7 px-2 text-xs"
                >
                  <Code className="w-3.5 h-3.5 mr-1" />
                  编辑
                </Button>
                <div className="w-px h-4 bg-border" />
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

            {/* Preview Mode - Three-way merge view */}
            {viewMode === 'preview' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Quick Actions */}
                <div className="shrink-0 border-b border-border/40 px-4 py-3 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground mb-3">快速解决:</div>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(selectedConflict, 'current')}
                      disabled={isResolving === selectedConflict}
                      className="h-9 text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      当前版本
                      <span className="text-[9px] opacity-60 ml-0.5">(ours)</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(selectedConflict, 'incoming')}
                      disabled={isResolving === selectedConflict}
                      className="h-9 text-xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                      传入版本
                      <span className="text-[9px] opacity-60 ml-0.5">(theirs)</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={combineVersions}
                      disabled={!parsedConflict}
                      className="h-9 text-xs"
                    >
                      <Code className="w-3.5 h-3.5 mr-1" />
                      合并版本
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewMode('editor')}
                      className="h-9 text-xs"
                    >
                      <Code className="w-3.5 h-3.5 mr-1" />
                      手动编辑
                    </Button>
                  </div>
                </div>

                {/* Three-way view */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {parsedConflict ? (
                    <div className="grid grid-cols-3 divide-x divide-border/40">
                      {/* Current */}
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-xs font-semibold text-foreground">当前版本 (ours)</span>
                        </div>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-blue-500/5 p-3 rounded-lg text-foreground/80">
                          {parsedConflict.current || '<空>'}
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectVersion('current')}
                          className="w-full mt-2 h-7 text-xs"
                        >
                          使用此版本
                        </Button>
                      </div>

                      {/* Incoming */}
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs font-semibold text-foreground">传入版本 (theirs)</span>
                        </div>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-green-500/5 p-3 rounded-lg text-foreground/80">
                          {parsedConflict.incoming || '<空>'}
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectVersion('incoming')}
                          className="w-full mt-2 h-7 text-xs"
                        >
                          使用此版本
                        </Button>
                      </div>

                      {/* Combined/Merged */}
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          <span className="text-xs font-semibold text-foreground">原始内容</span>
                        </div>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/30 p-3 rounded-lg text-foreground/60">
                          {conflictContent}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/90">
                        {conflictContent || '无法解析冲突标记'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editor Mode */}
            {viewMode === 'editor' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="shrink-0 border-b border-border/40 px-4 py-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">编辑冲突内容 - 保存后将标记为已解决</span>
                    <Button
                      size="sm"
                      onClick={handleManualResolve}
                      disabled={isSaving}
                      className="h-7 text-xs"
                    >
                      <Save className={cn("w-3.5 h-3.5 mr-1", isSaving && "animate-spin")} />
                      {isSaving ? '保存中...' : '保存并解决'}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <textarea
                    ref={fileInputRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-full p-4 text-xs font-mono bg-background border border-border/60 rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all outline-none resize-none custom-scrollbar"
                    placeholder="编辑冲突内容..."
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
