import { useRepoStore } from '../store/repoStore';
import { FileList } from './FileList';
import { CommitPanel } from './CommitPanel';
import { BranchSelector } from './BranchSelector';
import { AlertCircle } from 'lucide-react';
import { Badge } from './ui/Badge';

interface RepoViewProps {
  repoPath: string;
}

export function RepoView({ repoPath }: RepoViewProps) {
  const { repositories } = useRepoStore();
  const repo = repositories.find((r) => r.path === repoPath);

  if (!repo) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-semibold">{repo.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <BranchSelector repoPath={repoPath} />
            {(repo.ahead > 0 || repo.behind > 0) && (
              <Badge variant="outline" className="text-xs">
                {repo.ahead > 0 && `↑${repo.ahead} `}
                {repo.behind > 0 && `↓${repo.behind}`}
              </Badge>
            )}
            {repo.hasChanges && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertCircle className="w-3 h-3" />
                未提交的更改
              </span>
            )}
          </div>
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
