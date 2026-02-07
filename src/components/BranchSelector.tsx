import { useRepoStore } from '../store/repoStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { GitBranch, Cloud, Check, Upload, Trash2, Edit3, Copy } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../lib/utils';

import { CreateBranchDialog } from './CreateBranchDialog';

interface BranchSelectorProps {
  repoPath: string;
}

export function BranchSelector({ repoPath }: BranchSelectorProps) {
  const { 
    currentBranchInfo, 
    localBranches, 
    switchBranch, 
    publishBranch, 
    pushBranch, 
    deleteBranch,
    renameBranch,
    createBranch,
    loadLocalBranches, 
    refreshBranchInfo 
  } = useRepoStore();
  const { gitUsername: savedUsername, gitPassword } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gitUsername, setGitUsername] = useState<string>(savedUsername || '');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, branch: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [baseBranchForCreate, setBaseBranchForCreate] = useState<string | null>(null);

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

  const currentBranch = currentBranchInfo?.current || '';
  const isPublished = currentBranchInfo?.isPublished ?? false;
  const needPush = currentBranchInfo?.needPush ?? false;

  const handleSwitchBranch = async (branchName: string) => {
    try {
      await switchBranch(repoPath, branchName);
      setIsOpen(false);
    } catch (e) {
      console.error('切换分支失败:', e);
    }
  };

  const handlePublish = async () => {
    if (!gitPassword) {
      setErrorMessage('请先在设置中配置 Git Token');
      return;
    }
    if (!gitUsername) {
      setErrorMessage('请先在设置中配置 Git 用户名');
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    try {
      await publishBranch(
        repoPath,
        currentBranch,
        'origin',
        gitUsername,
        gitPassword
      );
      await refreshBranchInfo(repoPath);
      setIsOpen(false);
    } catch (e) {
      console.error('发布分支失败:', e);
      setErrorMessage(String(e));
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePush = async () => {
    if (!gitPassword) {
      setErrorMessage('请先在设置中配置 Git Token');
      return;
    }
    if (!gitUsername) {
      setErrorMessage('请先在设置中配置 Git 用户名');
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    try {
      await pushBranch(
        repoPath,
        currentBranch,
        'origin',
        gitUsername,
        gitPassword
      );
      await refreshBranchInfo(repoPath);
      setIsOpen(false);
    } catch (e) {
      console.error('推送失败:', e);
      setErrorMessage(String(e));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, branchName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, branch: branchName });
  };

  const handleDeleteBranch = async (branchName: string) => {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask(`确定要删除分支 "${branchName}" 吗？`, {
        title: '删除分支',
        kind: 'warning',
      });
      if (!confirmed) return;

      await deleteBranch(repoPath, branchName);
      setContextMenu(null);
    } catch (e) {
      console.error('删除分支失败:', e);
      setErrorMessage(String(e));
    }
  };

  const handleRenameBranch = async (branchName: string) => {
    try {
      // For now we don't have a prompt dialog in Tauri plugin-dialog that returns text
      // We'll use a simple window.prompt for now
      const newName = window.prompt(`重命名分支 "${branchName}" 为:`, branchName);
      if (newName && newName !== branchName) {
        await renameBranch(repoPath, branchName, newName);
        setContextMenu(null);
      }
    } catch (e) {
      console.error('重命名分支失败:', e);
      setErrorMessage(String(e));
    }
  };

  const handleCreateBranchClick = (branchName: string) => {
    setBaseBranchForCreate(branchName);
    setCreateDialogOpen(true);
    setContextMenu(null);
  };

  const handleCreateBranchConfirm = async (newBranchName: string) => {
    if (baseBranchForCreate) {
      await createBranch(repoPath, newBranchName, baseBranchForCreate);
      // Optional: switch to new branch automatically?
      // await switchBranch(repoPath, newBranchName);
    }
  };

  const handleCopyBranchName = (branchName: string) => {
    navigator.clipboard.writeText(branchName);
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    loadLocalBranches(repoPath);
    setIsOpen(true);
    setErrorMessage(null);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="gap-2"
      >
        <GitBranch className="w-4 h-4" />
        <span>{currentBranch}</span>
        {needPush && currentBranch && (
          <span className="text-xs text-amber-500">↑{currentBranchInfo?.ahead || 0}</span>
        )}
        {!isPublished && currentBranch && (
          <span className="text-xs text-muted-foreground">(未发布)</span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute z-20 top-full mt-1 w-64 max-h-80 overflow-y-auto">
            <div className="p-2 space-y-1">
              {localBranches.map((branch) => (
                <div
                  key={branch.name}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer group transition-all duration-150",
                    branch.isHead && "bg-primary/5"
                  )}
                  onClick={() => handleSwitchBranch(branch.name)}
                  onContextMenu={(e) => handleContextMenu(e, branch.name)}
                >
                  <div className="flex items-center gap-2">
                    {branch.isHead ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <div className="w-3.5 h-3.5" /> // Spacer
                    )}
                    <span className={cn("text-sm", branch.isHead && "font-semibold text-primary")}>
                      {branch.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {branch.upstream && (
                      <Cloud className="w-3 h-3 text-muted-foreground/60" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Context Menu Portal (Simplified as overflow-visible container) */}
            {contextMenu && (
              <div 
                ref={menuRef}
                className="fixed z-[100] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  分支: {contextMenu.branch}
                </div>
                
                <button 
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary hover:text-white flex items-center gap-2"
                  onClick={() => handleCreateBranchClick(contextMenu.branch)}
                >
                  <GitBranch className="w-4 h-4" /> 基于此分支新建
                </button>
                
                <button 
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary hover:text-white flex items-center gap-2"
                  onClick={() => handleRenameBranch(contextMenu.branch)}
                >
                  <Edit3 className="w-4 h-4" /> 重命名
                </button>
                
                <button 
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary hover:text-white flex items-center gap-2"
                  onClick={() => handleCopyBranchName(contextMenu.branch)}
                >
                  <Copy className="w-4 h-4" /> 复制名称
                </button>
                
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                
                <button 
                  className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-2"
                  onClick={() => handleDeleteBranch(contextMenu.branch)}
                >
                  <Trash2 className="w-4 h-4" /> 删除分支
                </button>
              </div>
            )}

            {baseBranchForCreate && (
              <CreateBranchDialog
                isOpen={createDialogOpen}
                baseBranch={baseBranchForCreate}
                onClose={() => {
                  setCreateDialogOpen(false);
                  setBaseBranchForCreate(null);
                }}
                onCreate={handleCreateBranchConfirm}
              />
            )}

            {/* 操作按钮区域 */}
            {(needPush || !isPublished) && currentBranch && (
              <div className="border-t p-2 space-y-2">
                {needPush && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePush();
                    }}
                    disabled={isPublishing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isPublishing ? '推送中...' : `推送提交 (${currentBranchInfo?.ahead || 0})`}
                  </Button>
                )}
                {!isPublished && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePublish();
                    }}
                    disabled={isPublishing}
                  >
                    <Cloud className="w-4 h-4 mr-2" />
                    {isPublishing ? '发布中...' : '发布分支'}
                  </Button>
                )}
                {errorMessage && (
                  <p className="text-xs text-red-500">{errorMessage}</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
