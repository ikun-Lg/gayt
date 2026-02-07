import { useRepoStore } from '../store/repoStore';
import { useSettingsStore } from '../store/settingsStore';
import { FileList } from './FileList';
import { CommitPanel } from './CommitPanel';
import { BranchSelector } from './BranchSelector';
import { AlertCircle, Upload } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../lib/utils';

interface RepoViewProps {
  repoPath: string;
}

export function RepoView({ repoPath }: RepoViewProps) {
  const { repositories, pushBranch, refreshBranchInfo, currentBranchInfo } = useRepoStore();
  const { gitUsername: savedUsername, gitPassword } = useSettingsStore();
  const repo = repositories.find((r) => r.path === repoPath);
  const [isPushing, setIsPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [gitUsername, setGitUsername] = useState<string>(savedUsername || '');

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

  if (!repo) return null;

  const needPush = (currentBranchInfo?.needPush ?? false) || repo.ahead > 0;
  const currentBranch = currentBranchInfo?.current || repo.branch || '';

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

  return (
    <div id="repo-view-container" className="flex flex-col h-full animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-background/40 backdrop-blur-sm border-b transition-all duration-300">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight">{repo.name}</h1>
          <div className="flex items-center gap-3">
            <BranchSelector repoPath={repoPath} />
            {(repo.ahead > 0 || repo.behind > 0) && (
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-bold px-2 py-0.5 rounded-md">
                {repo.ahead > 0 && `↑${repo.ahead} `}
                {repo.behind > 0 && `↓${repo.behind}`}
              </Badge>
            )}
            {repo.hasChanges && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 px-2 py-0.5 rounded-md">
                <AlertCircle className="w-3 h-3" />
                待提交
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pushError && (
            <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-md animate-shake">{pushError}</span>
          )}
          {needPush && (
            <Button
              size="sm"
              variant="default"
              onClick={handlePush}
              disabled={isPushing}
              className="shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 active:scale-95 btn-tactile"
            >
              <Upload className={cn("w-4 h-4 mr-2", isPushing && "animate-pulse")} />
              {isPushing ? '正在推送...' : `推送变更 (${currentBranchInfo?.ahead || repo.ahead})`}
            </Button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        <FileList repoPath={repoPath} />
      </div>

      {/* Commit panel */}
      <CommitPanel repoPath={repoPath} mode="single" />
    </div>
  );
}
