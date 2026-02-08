
import { useRepoStore } from '../store/repoStore';
import { useSettingsStore } from '../store/settingsStore';
import { FileList } from './FileList';
import { CommitPanel } from './CommitPanel';
import { BranchSelector } from './BranchSelector';
import { DiffView } from './DiffView';
import { StashPanel } from './StashPanel';
import { TagList } from './TagList';
import { ConflictPanel } from './ConflictPanel';
import { RebasePanel } from './RebasePanel';
import { VirtualizedCommitList } from './VirtualizedCommitList';
import { ShortcutHelp } from './ShortcutHelp';
import { AlertCircle, Upload, RotateCcw, Download, GitGraph, Clock, FileDiff, Archive, Tag, Globe, AlertTriangle, GitBranch, Keyboard } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../lib/utils';
import { CommitGraph } from './CommitGraph';
import { RemoteManagementDialog } from './RemoteManagementDialog';
import { OperationLogPanel } from './OperationLogPanel';
import { shortcutManager } from '../lib/shortcuts';
import { History } from 'lucide-react';

interface RepoViewProps {
  repoPath: string;
}

type ViewMode = 'changes' | 'history' | 'stashes' | 'tags' | 'conflicts' | 'rebase';

export function RepoView({ repoPath }: RepoViewProps) {
  const {
    repositories,
    pushBranch,
    fetch,
    pull,
    refreshBranchInfo,
    currentBranchInfo,
    revokeLatestCommit,
    currentStatus,
    commitHistory,
    loadCommitHistory,
    loadMoreCommits,
    hasMoreCommits,
    isLoadingMoreCommits,
    selectedFile,
    selectedFileDiff,
    selectFile,
    mergeState,
    getMergeState,
    rebaseState,
    getRebaseState: checkRebaseState
  } = useRepoStore();
  const { gitUsername: savedUsername, gitPassword, shortcuts } = useSettingsStore();

  const repo = repositories.find((r) => r.path === repoPath);
  
  const [viewMode, setViewMode] = useState<ViewMode>('changes');
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [gitUsername, setGitUsername] = useState<string>(savedUsername || '');
  const [showGraph, setShowGraph] = useState(true); // Default to showing graph in history mode
  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false);
  const [showOperationLog, setShowOperationLog] = useState(false);

  // Auto-check for conflicts after pull/merge operations
  useEffect(() => {
    getMergeState(repoPath);
    checkRebaseState(repoPath);
  }, [repoPath]);

  // Auto-switch to conflicts view when merge is detected
  useEffect(() => {
    if (mergeState?.isMergeInProgress && viewMode !== 'conflicts') {
      setViewMode('conflicts');
    }
  }, [mergeState?.isMergeInProgress]);

  // Auto-switch to rebase view when rebase is detected
  useEffect(() => {
    if (rebaseState?.isRebaseInProgress && viewMode !== 'rebase') {
      setViewMode('rebase');
    }
  }, [rebaseState?.isRebaseInProgress]);

  // Load git username from config if not saved
  useEffect(() => {
    if (!savedUsername) {
      invoke<string | null>('get_git_username', { path: repoPath })
        .then(name => {
          if (name) setGitUsername(name);
        })
        .catch(() => {});
    } else {
      setGitUsername(savedUsername);
    }
  }, [repoPath, savedUsername]);

  // Load commit history when switching to history view
  useEffect(() => {
    if (viewMode === 'history') {
      loadCommitHistory(repoPath);
      // Clear selected file when switching to history
      selectFile(repoPath, null);
    }
  }, [viewMode, repoPath, loadCommitHistory, selectFile]);

  // Register keyboard shortcuts
  useEffect(() => {
    const stageAll = useRepoStore.getState().stageAll;
    const unstageAll = useRepoStore.getState().unstageAll;
    const stashSave = useRepoStore.getState().stashSave;
    // shortcuts is available from component scope

    const unregister = shortcutManager.registerAll([
      {
        key: shortcuts['stageAll']?.key || 'a',
        ctrlKey: shortcuts['stageAll']?.ctrlKey,
        shiftKey: shortcuts['stageAll']?.shiftKey,
        altKey: shortcuts['stageAll']?.altKey,
        metaKey: shortcuts['stageAll']?.metaKey,
        description: '全部暂存',
        enabled: () => viewMode === 'changes',
        action: () => stageAll(repoPath),
      },
      {
        key: shortcuts['unstageAll']?.key || 'a',
        ctrlKey: shortcuts['unstageAll']?.ctrlKey,
        shiftKey: shortcuts['unstageAll']?.shiftKey,
        altKey: shortcuts['unstageAll']?.altKey,
        metaKey: shortcuts['unstageAll']?.metaKey,
        description: '全部取消暂存',
        enabled: () => viewMode === 'changes',
        action: () => unstageAll(repoPath),
      },
      {
        key: shortcuts['refresh']?.key || 'r',
        ctrlKey: shortcuts['refresh']?.ctrlKey,
        shiftKey: shortcuts['refresh']?.shiftKey,
        altKey: shortcuts['refresh']?.altKey,
        metaKey: shortcuts['refresh']?.metaKey,
        description: '刷新',
        action: () => refreshBranchInfo(repoPath),
      },
      {
        key: shortcuts['stash']?.key || 's',
        ctrlKey: shortcuts['stash']?.ctrlKey,
        shiftKey: shortcuts['stash']?.shiftKey,
        altKey: shortcuts['stash']?.altKey,
        metaKey: shortcuts['stash']?.metaKey,
        description: '贮存',
        enabled: () => viewMode === 'changes',
        action: () => stashSave(repoPath),
      },
      {
        key: shortcuts['historyView']?.key || 'h',
        ctrlKey: shortcuts['historyView']?.ctrlKey,
        shiftKey: shortcuts['historyView']?.shiftKey,
        altKey: shortcuts['historyView']?.altKey,
        metaKey: shortcuts['historyView']?.metaKey,
        description: '历史视图',
        action: () => setViewMode('history'),
      },
      {
        key: shortcuts['changesView']?.key || '1',
        ctrlKey: shortcuts['changesView']?.ctrlKey,
        shiftKey: shortcuts['changesView']?.shiftKey,
        altKey: shortcuts['changesView']?.altKey,
        metaKey: shortcuts['changesView']?.metaKey,
        description: '变更视图',
        action: () => setViewMode('changes'),
      },
      {
        key: '?',
        description: '快捷键帮助',
        action: () => setShowShortcutHelp(true),
      },
    ]);

    return () => unregister();
  }, [repoPath, viewMode, useSettingsStore.getState().shortcuts]);

  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  if (!repo) return null;

  const needPush = (currentBranchInfo?.needPush ?? false) || repo.ahead > 0;
  const currentBranch = currentBranchInfo?.current || repo.branch || '';

  const handleFetch = async () => {
    if (!gitPassword) {
      setPushError('请先在设置中配置 Git Token');
      return;
    }
    if (!gitUsername) {
      setPushError('请先在设置中配置 Git 用户名');
      return;
    }

    setIsFetching(true);
    setPushError(null);
    try {
      await fetch(repoPath, 'origin', gitUsername, gitPassword);
    } catch (e) {
      console.error('Fetch failed:', e);
      setPushError(String(e));
    } finally {
      setIsFetching(false);
    }
  };

  const handlePull = async () => {
    if (!gitPassword) {
      setPushError('请先在设置中配置 Git Token');
      return;
    }
    if (!gitUsername) {
      setPushError('请先在设置中配置 Git 用户名');
      return;
    }

    setIsPulling(true);
    setPushError(null);
    try {
      await pull(repoPath, 'origin', undefined, false, gitUsername, gitPassword);
    } catch (e) {
      console.error('Pull failed:', e);
      setPushError(String(e));
       // 触发屏幕晃动反馈
       const element = document.getElementById('repo-view-container');
       if (element) {
         element.classList.remove('animate-shake');
         void element.offsetWidth; // trigger reflow
         element.classList.add('animate-shake');
       }
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (!gitPassword) {
      setPushError('请先在设置中配置 Git Token');
      return;
    }
    if (!gitUsername) {
      setPushError('请先在设置中配置 Git 用户名');
      return;
    }

    setIsPushing(true);
    setPushError(null);
    try {
      // First check if there are staged changes to commit
      const hasStagedChanges = currentStatus && currentStatus.staged.length > 0;

      if (hasStagedChanges) {
        // Generate a simple commit message if there are staged changes
        const commitMessage = `Update ${currentBranch}`;

        // Use the commit command from store
        const { commit } = useRepoStore.getState();
        await commit(repoPath, commitMessage);

        // Clear the commit panel message if exists
        const commitInput = document.getElementById('commit-message-input') as HTMLTextAreaElement;
        if (commitInput) {
          commitInput.value = '';
        }
      }

      // Then push
      await pushBranch(
        repoPath,
        currentBranch,
        'origin',
        gitUsername,
        gitPassword
      );
      await refreshBranchInfo(repoPath);
    } catch (e) {
      console.error('推送失败:', e);
      setPushError(String(e));
      // 触发屏幕晃动反馈
      const element = document.getElementById('repo-view-container');
      if (element) {
        element.classList.remove('animate-shake');
        void element.offsetWidth; // trigger reflow
        element.classList.add('animate-shake');
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handleRevoke = async () => {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask('确定要撤回最后一次提交吗？\n\n此操作将撤销最后一次提交，但保留所有更改在暂存区中。', {
        title: '确认撤回提交',
        kind: 'warning',
        okLabel: '撤回',
        cancelLabel: '取消'
      });
      
      if (!confirmed) return;
    
      setIsRevoking(true);
      await revokeLatestCommit(repoPath);
      // Refresh history if in history mode
      if (viewMode === 'history') {
        loadCommitHistory(repoPath);
      }
    } catch (e) {
      console.error('撤回失败:', e);
      setPushError(String(e));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div id="repo-view-container" className="flex flex-col h-full bg-background/50">
      {/* Header - macOS style toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-glass/50 shrink-0 z-10">
        <div className="flex flex-col gap-1">
           <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{repo.name}</h1>
            <BranchSelector repoPath={repoPath} />
           </div>
           
           <div className="flex items-center gap-1.5 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={handleFetch}
              disabled={isFetching}
              title="获取远程更新"
            >
              <Download className={cn("w-3 h-3", isFetching && "animate-bounce")} />
              {isFetching ? '获取中...' : 'Fetch'}
            </Button>

            <Button
              size="sm"
              variant="ghost" 
              className="h-6 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={handlePull}
              disabled={isPulling}
              title="拉取远程更新并合并"
            >
              <Download className={cn("w-3 h-3", isPulling && "animate-bounce")} />
              {isPulling ? '拉取中...' : 'Pull'}
            </Button>

            <div className="w-px h-3 bg-border/50 mx-1" />

            {isPushing ? (
              <Badge variant="outline" className="h-6 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Upload className="w-3 h-3 animate-bounce" />
                推送中...
              </Badge>
            ) : currentBranchInfo?.needPush ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1.5 text-xs font-normal border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                onClick={handlePush}
              >
                <Upload className="w-3 h-3" />
                推送提交
              </Button>
            ) : currentBranchInfo && currentBranchInfo.ahead > 0 ? (
               <Badge variant="outline" className="h-6 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Upload className="w-3 h-3" />
                超前 {currentBranchInfo.ahead}
              </Badge>
            ) : null}

            {currentBranchInfo && currentBranchInfo.behind > 0 && (
               <Badge variant="outline" className="h-6 gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                <Download className="w-3 h-3" />
                落后 {currentBranchInfo.behind}
              </Badge>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              onClick={() => refreshBranchInfo(repoPath)}
              title="刷新状态"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>

            <Button
              size="sm"
              variant="ghost" 
              className="h-9 w-9 p-0"
              onClick={() => setIsRemoteDialogOpen(true)}
              title="远程仓库管理"
            >
              <Globe className="w-5 h-5" />
            </Button>
            
            <Button
              size="sm"
              variant={showOperationLog ? "secondary" : "ghost"}
              className="h-9 w-9 p-0"
              onClick={() => setShowOperationLog(!showOperationLog)}
              title="操作历史 (Undo/Redo)"
            >
              <History className="w-5 h-5" />
            </Button>
           </div>
        </div>
        
        {/* View Switcher & Actions */}
        <div className="flex items-center gap-4">
           {/* View Modes */}
           <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border/50">
              <button
                onClick={() => setViewMode('changes')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === 'changes' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <FileDiff className="w-3.5 h-3.5" />
                变更
                {repo.hasChanges && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === 'history' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                历史
              </button>
              <button
                onClick={() => setViewMode('stashes')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === 'stashes' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Archive className="w-3.5 h-3.5" />
                贮存
              </button>
              <button
                onClick={() => setViewMode('tags')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === 'tags'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Tag className="w-3.5 h-3.5" />
                标签
              </button>
              {mergeState?.isMergeInProgress && (
                <button
                  onClick={() => setViewMode('conflicts')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all",
                    viewMode === 'conflicts'
                      ? "bg-destructive/10 shadow-sm text-destructive border border-destructive/30"
                      : "text-destructive/70 hover:text-destructive hover:bg-destructive/5"
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  冲突
                  {mergeState.conflictCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 text-[9px] bg-destructive text-white rounded-full">
                      {mergeState.conflictCount}
                    </span>
                  )}
                </button>
              )}
            </div>

           <div className="flex items-center gap-3">
             {pushError && (
               <span className="text-xs font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg animate-shake">{pushError}</span>
             )}
             
             {/* Global Actions (mostly for Changes view) */}
             {viewMode === 'changes' && (needPush || true) && (
                <div className="flex items-center gap-2">
                   {needPush && ( 
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={handleRevoke}
                       disabled={isRevoking || isPushing}
                       className="h-8 shadow-sm hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all btn-tactile"
                       title="撤销上次提交"
                     >
                       <RotateCcw className={cn("w-3.5 h-3.5", isRevoking && "animate-spin")} style={{ animationDirection: 'reverse' }} />
                     </Button>
                   )}
                   
                   <Button
                     size="sm"
                     variant="default"
                     onClick={handlePush}
                     disabled={isPushing || isRevoking || !needPush}
                     className={cn(
                       "h-8 shadow-sm transition-all btn-tactile font-medium px-4",
                       needPush ? "opacity-100" : "opacity-50 grayscale"
                     )}
                   >
                     <Upload className={cn("w-3.5 h-3.5 mr-2", isPushing && "animate-pulse")} />
                     {isPushing ? '推送中...' : '提交推送'}
                   </Button>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex">
        
        <div className="flex-1 relative flex flex-col min-w-0">
            {/* Changes View */}
            {viewMode === 'changes' && (
                <div className="absolute inset-0 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex-1 flex min-h-0">
                    {/* Left side: File List */}
                    <div className={cn(
                      "flex flex-col flex-1 min-w-0 transition-all duration-300",
                      selectedFile ? "w-1/3" : "w-full"
                    )}>
                      {/* File status summary */}
                      {(currentStatus && (currentStatus.staged.length > 0 || currentStatus.unstaged.length > 0 || currentStatus.untracked.length > 0)) && (
                        <div className="shrink-0 border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                              <span className="text-sm font-medium">未提交的修改</span>
                              <Badge variant="secondary" className="lc-badge">
                                {(currentStatus.staged.length || 0) + (currentStatus.unstaged.length || 0) + (currentStatus.untracked.length || 0)}
                              </Badge>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        <FileList repoPath={repoPath} />
                      </div>
                    </div>

                    {/* Right side: Diff View */}
                    {selectedFile && (
                      <div className="w-2/3 border-l border-border/40 animate-in slide-in-from-right duration-300">
                        <DiffView 
                          repoPath={repoPath}
                          filename={selectedFile} 
                          diff={selectedFileDiff} 
                          onClose={() => selectFile(repoPath, null)} 
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="shrink-0 z-20">
                    <CommitPanel repoPath={repoPath} mode="single" />
                  </div>
                </div>
            )}

            {/* History View */}
            {viewMode === 'history' && (
               <div className="absolute inset-0 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                 <div className="shrink-0 border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="text-sm font-medium text-muted-foreground">提交历史</div>
                     {commitHistory.length > 1 && (
                       <Button
                         variant="outline"
                         className="h-6 gap-1.5 text-xs text-purple-600 border-purple-500/30 hover:bg-purple-500/5"
                         onClick={() => setViewMode('rebase')}
                       >
                         <GitBranch className="w-3.5 h-3.5" />
                         交互式 Rebase
                       </Button>
                     )}
                   </div>
                   <Button
                     size="sm"
                     variant={showGraph ? "secondary" : "ghost"}
                     className="h-6 gap-1.5 text-xs"
                     onClick={() => setShowGraph(!showGraph)}
                   >
                     <GitGraph className="w-3.5 h-3.5" />
                     {showGraph ? '隐藏图表' : '显示图表'}
                   </Button>
                 </div>

                 <div className="flex-1 overflow-hidden relative">
                    {showGraph && commitHistory.length > 0 && (
                       <CommitGraph commits={commitHistory} rowHeight={56} />
                    )}

                    {commitHistory.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <GitGraph className="w-10 h-10 mb-3 opacity-20" />
                          <p>暂无提交记录</p>
                       </div>
                    ) : (
                       <VirtualizedCommitList
                          commits={commitHistory}
                          rowHeight={56}
                          showGraph={showGraph}
                          graphWidth={showGraph ? 80 : 0}
                          onLoadMore={() => loadMoreCommits(repoPath)}
                          hasMore={hasMoreCommits}
                          isLoadingMore={isLoadingMoreCommits}
                       />
                    )}
                 </div>
               </div>
            )}

            {/* Stashes View */}
            {viewMode === 'stashes' && (
               <div className="absolute inset-0 animate-in fade-in zoom-in-95 duration-200">
                 <StashPanel />
               </div>
            )}

            {/* Tags View */}
            {viewMode === 'tags' && (
               <div className="absolute inset-0 animate-in fade-in zoom-in-95 duration-200">
                 <TagList />
               </div>
            )}

            {/* Conflicts View */}
            {viewMode === 'conflicts' && (
               <div className="absolute inset-0 animate-in fade-in zoom-in-95 duration-200">
                 <ConflictPanel repoPath={repoPath} onResolve={() => {
                   setViewMode('changes');
                 }} />
               </div>
            )}

            {/* Rebase View */}
            {viewMode === 'rebase' && (
               <div className="absolute inset-0 animate-in fade-in zoom-in-95 duration-200">
                 <RebasePanel
                   repoPath={repoPath}
                   commits={commitHistory}
                   onClose={() => {
                     setViewMode('history');
                   }}
                   onComplete={() => {
                     setViewMode('history');
                     loadCommitHistory(repoPath);
                   }}
                 />
               </div>
            )}
        </div>

        {/* Operation Log Panel */}
        {showOperationLog && (
            <div className="shrink-0 h-full border-l border-border/40 bg-background/95 backdrop-blur z-20">
                <OperationLogPanel repoPath={repoPath} onClose={() => setShowOperationLog(false)} />
            </div>
        )}

      </div>
      <RemoteManagementDialog
        isOpen={isRemoteDialogOpen}
        onClose={() => setIsRemoteDialogOpen(false)}
        repoPath={repoPath}
      />
      <ShortcutHelp
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />

      {/* Floating shortcut help button */}
      <button
        onClick={() => setShowShortcutHelp(true)}
        className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors shadow-lg border border-primary/20"
        title="快捷键帮助 (?)"
      >
        <Keyboard className="w-5 h-5" />
      </button>
    </div>
  );
}
