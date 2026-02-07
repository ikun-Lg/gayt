import { useRepoStore } from '../store/repoStore';
import { RepoListItem } from './RepoListItem';
import { Button } from './ui/Button';
import { RefreshCw, FolderOpen, Settings, DownloadCloud } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { CloneDialog } from './CloneDialog';

interface RepoListProps {
  onScanClick: () => void;
  onSettingsClick: () => void;
}

export function RepoList({ onScanClick, onSettingsClick }: RepoListProps) {
  const { repositories, selectedRepoPath, selectRepo } = useRepoStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    for (const repo of repositories) {
      await useRepoStore.getState().refreshStatus(repo.path);
      await useRepoStore.getState().refreshBranchInfo(repo.path);
    }
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="group flex items-center justify-between px-4 pt-10 pb-3 sticky top-0 z-10 shrink-0 drag-region">
        <h2 className="font-semibold text-xs text-muted-foreground/70 tracking-wide uppercase">项目仓库</h2>
        <div className="flex items-center gap-1 transition-opacity duration-200">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCloneDialogOpen(true)}
            className="w-6 h-6 hover:bg-muted text-muted-foreground transition-all duration-200"
            title="克隆仓库"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing || repositories.length === 0}
            className="w-6 h-6 hover:bg-muted text-muted-foreground transition-all duration-200"
            title="全部刷新"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onScanClick} 
            className="w-6 h-6 hover:bg-muted text-muted-foreground transition-all duration-200"
            title="扫描并添加目录"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <FolderOpen className="w-8 h-8 opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">未找到项目仓库</p>
              <p className="text-xs">扫描本地目录以开始管理您的 Git 项目</p>
            </div>
            <div className="flex gap-2 mt-2">
                <Button 
                onClick={onScanClick}
                size="sm"
                className="shadow-sm"
                >
                选择目录
                </Button>
                <Button 
                onClick={() => setIsCloneDialogOpen(true)}
                size="sm"
                variant="outline"
                className="shadow-sm"
                >
                克隆仓库
                </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {repositories.map((repo) => (
              <RepoListItem
                key={repo.path}
                repo={repo}
                isSelected={selectedRepoPath === repo.path}
                onClick={() => selectRepo(repo.path)}
              />
            ))}
          </div>
        )}
      </div>

      {repositories.length > 0 && (
        <div className="p-3 border-t flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/60">{repositories.length} 个仓库</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={onSettingsClick}
            className="w-7 h-7 hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-all duration-200"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <CloneDialog 
        isOpen={isCloneDialogOpen} 
        onClose={() => setIsCloneDialogOpen(false)} 
      />
    </div>
  );
}
