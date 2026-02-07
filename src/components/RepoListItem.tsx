import { Checkbox } from './ui/Checkbox';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';
import { GitBranch, GitCommit, AlertCircle } from 'lucide-react';
import type { Repository } from '../types';

interface RepoListItemProps {
  repo: Repository;
  isSelected: boolean;
  isBatchSelected: boolean;
  onClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
}

export function RepoListItem({
  repo,
  isSelected,
  isBatchSelected,
  onClick,
  onToggle,
}: RepoListItemProps) {
  const statusColor = repo.hasChanges ? 'text-amber-500' : 'text-green-500';

  return (
    <div
      className={cn(
        'group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-300',
        'hover:bg-accent/40 hover:shadow-md hover:-translate-y-0.5 active:scale-95 btn-tactile animate-enter',
        isSelected ? 'bg-primary/5 shadow-inner ring-1 ring-primary/20' : 'bg-transparent'
      )}
      onClick={onClick}
    >
      <div className="flex-shrink-0">
        <Checkbox checked={isBatchSelected} onToggle={onToggle} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold truncate text-[14px] tracking-tight leading-tight",
            isSelected ? "text-primary" : "text-foreground"
          )}>{repo.name}</span>
          {repo.hasChanges && (
            <Badge variant="destructive" className="px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-bold text-[9px] rounded-full">
              {repo.stagedCount + repo.unstagedCount + repo.untrackedCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/80 mt-0.5">
          {repo.branch && (
            <span className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
              <GitBranch className="w-3 h-3 text-primary/70" />
              {repo.branch}
            </span>
          )}
          {(repo.ahead > 0 || repo.behind > 0) && (
            <span className="flex items-center gap-1.5 font-bold tracking-tighter">
              {repo.ahead > 0 && <span className="text-primary">↑{repo.ahead}</span>}
              {repo.behind > 0 && <span className="text-destructive">↓{repo.behind}</span>}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
        {repo.hasChanges ? (
          <AlertCircle className={cn('w-4.5 h-4.5', statusColor)} />
        ) : (
          <GitCommit className={cn('w-4.5 h-4.5 opacity-40', statusColor)} />
        )}
      </div>
    </div>
  );
}
