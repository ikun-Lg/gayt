import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Plus, Minus, File, FilePlus, FileMinus, FileEdit, GitBranch } from 'lucide-react';
import type { FileStatus, StatusItem } from '../types';

interface FileListProps {
  repoPath: string;
}

interface FileSectionProps {
  title: string;
  files: StatusItem[];
  onStageFile: (file: string) => void;
  onUnstageFile: (file: string) => void;
  stageLabel: string;
  unstageLabel: string;
  icon: React.ReactNode;
}

function FileSection({
  title,
  files,
  onStageFile,
  onUnstageFile,
  stageLabel,
  unstageLabel,
  icon,
}: FileSectionProps) {
  if (files.length === 0) return null;

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-secondary/80">
          {icon}
        </div>
        <h3 className="text-[13px] font-bold tracking-tight text-foreground/80">{title}</h3>
        <Badge variant="outline" className="bg-secondary/40 border-secondary/60 text-[10px] h-4.5 px-1.5 font-bold rounded-md">
          {files.length}
        </Badge>
      </div>
      <div className="space-y-1 rounded-xl overflow-hidden border bg-background/30 backdrop-blur-sm">
        {files.map((item, index) => (
          <div
            key={`${item.path}-${index}`}
            className="group flex items-center gap-3 p-2.5 hover:bg-accent/40 active:bg-accent/60 transition-all duration-200 border-b last:border-b-0"
          >
            <div className="transition-transform duration-300 group-hover:scale-110">
              <FileIcon status={item.status} />
            </div>
            <span className="flex-1 text-[13px] font-medium truncate text-foreground/80 group-hover:text-foreground transition-colors duration-200">{item.path}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {onStageFile && stageLabel && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 hover:bg-primary/20 hover:text-primary rounded-md btn-tactile"
                  onClick={() => onStageFile(item.path)}
                  title={stageLabel}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                </Button>
              )}
              {onUnstageFile && unstageLabel && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 hover:bg-destructive/20 hover:text-destructive rounded-md btn-tactile"
                  onClick={() => onUnstageFile(item.path)}
                  title={unstageLabel}
                >
                  <Minus className="w-3.5 h-3.5 stroke-[3px]" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileIcon({ status }: { status: FileStatus }) {
  const iconProps = { className: 'w-4 h-4 text-muted-foreground/60' };

  switch (status) {
    case 'added':
      return <FilePlus className="w-4 h-4 text-green-500 drop-shadow-[0_0_3px_rgba(34,197,94,0.3)]" />;
    case 'deleted':
      return <FileMinus className="w-4 h-4 text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.3)]" />;
    case 'modified':
      return <FileEdit className="w-4 h-4 text-amber-500 drop-shadow-[0_0_3px_rgba(245,158,11,0.3)]" />;
    case 'renamed':
      return <File className="w-4 h-4 text-blue-500 drop-shadow-[0_0_3px_rgba(59,130,246,0.3)]" />;
    default:
      return <File {...iconProps} />;
  }
}

export function FileList({ repoPath }: FileListProps) {
  const { currentStatus, stageFile, unstageFile, stageAll, unstageAll } = useRepoStore();

  if (!currentStatus) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  const totalFiles =
    currentStatus.staged.length +
    currentStatus.unstaged.length +
    currentStatus.untracked.length +
    currentStatus.conflicted.length;

  if (totalFiles === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p>工作区干净</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto no-scrollbar bg-background selection:bg-primary/20">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          size="sm" 
          onClick={() => stageAll(repoPath)}
          className="rounded-xl px-4 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all duration-300 btn-tactile"
        >
          <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
          全部暂存
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => unstageAll(repoPath)}
          className="rounded-xl px-4 font-bold bg-muted/50 hover:bg-muted active:scale-95 transition-all duration-200 btn-tactile"
        >
          <Minus className="w-4 h-4 mr-2 stroke-[3px]" />
          全部取消
        </Button>
      </div>

      <div className="space-y-2">
        <FileSection
          title="已暂存区域"
          files={currentStatus.staged}
          onStageFile={() => {}}
          onUnstageFile={(file) => unstageFile(repoPath, file)}
          stageLabel=""
          unstageLabel="取消暂存"
          icon={<span className="text-[10px] font-black text-green-500">S</span>}
        />

        <FileSection
          title="工作区更改"
          files={currentStatus.unstaged}
          onStageFile={(file) => stageFile(repoPath, file)}
          onUnstageFile={() => {}}
          stageLabel="暂存文件"
          unstageLabel=""
          icon={<span className="text-[10px] font-black text-amber-500">M</span>}
        />

        <FileSection
          title="未跟踪文件"
          files={currentStatus.untracked}
          onStageFile={(file) => stageFile(repoPath, file)}
          onUnstageFile={() => {}}
          stageLabel="暂存文件"
          unstageLabel=""
          icon={<span className="text-[10px] font-black text-blue-500">U</span>}
        />

        {currentStatus.conflicted.length > 0 && (
          <FileSection
            title="代码冲突"
            files={currentStatus.conflicted}
            onStageFile={() => {}}
            onUnstageFile={() => {}}
            stageLabel=""
            unstageLabel=""
            icon={<span className="text-[10px] font-black text-destructive">C</span>}
          />
        )}
      </div>
    </div>
  );
}
