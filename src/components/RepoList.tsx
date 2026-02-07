import { useRepoStore } from '../store/repoStore';
import { RepoListItem } from './RepoListItem';
import { Button } from './ui/Button';
import { RefreshCw, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

interface RepoListProps {
  onScanClick: () => void;
}

export function RepoList({ onScanClick }: RepoListProps) {
  const { repositories, selectedRepoPath, selectedRepoPaths, selectRepo, toggleRepoSelection } = useRepoStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      <div className="flex items-center justify-between p-4 sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <h2 className="font-bold text-sm tracking-wide text-muted-foreground uppercase">代码仓库</h2>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing || repositories.length === 0}
            className="w-8 h-8 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            title="全部刷新"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onScanClick} 
            className="w-8 h-8 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            title="扫描目录"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">未找到仓库</p>
            <p className="text-xs mt-1">点击文件夹图标扫描目录</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {repositories.map((repo) => (
              <RepoListItem
                key={repo.path}
                repo={repo}
                isSelected={selectedRepoPath === repo.path}
                isBatchSelected={selectedRepoPaths.has(repo.path)}
                onClick={() => selectRepo(repo.path)}
                onToggle={(e) => {
                  e.stopPropagation();
                  toggleRepoSelection(repo.path);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {repositories.length > 0 && (
        <div className="p-4 border-t text-xs text-muted-foreground">
          {repositories.length} 个仓库
        </div>
      )}
    </div>
  );
}
