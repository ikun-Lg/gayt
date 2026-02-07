import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Plus, Minus, File, FilePlus, FileMinus, FileEdit, GitBranch, AlertTriangle } from 'lucide-react';
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
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

function FileSection({
  title,
  files,
  onStageFile,
  onUnstageFile,
  stageLabel,
  unstageLabel,
  icon,
  selectedFile,
  onSelectFile,
}: FileSectionProps) {
  if (files.length === 0) return null;

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-2 px-2 opacity-70 group hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-secondary/50">
          {icon}
        </div>
        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{title}</h3>
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {files.length}
        </span>
      </div>
      <div className="space-y-[1px] rounded-lg overflow-hidden border border-border/50 bg-card/40 backdrop-blur-sm">
        {files.map((item, index) => (
          <div
            key={`${item.path}-${index}`}
            onClick={() => onSelectFile(item.path)}
            className={`group flex items-center gap-3 px-3 py-2 hover:bg-accent/10 active:bg-accent/20 transition-colors duration-100 cursor-default ${
              selectedFile === item.path ? 'bg-accent/20' : ''
            }`}
          >
            <div className="opacity-70 group-hover:opacity-100 transition-opacity">
              <FileIcon status={item.status} />
            </div>
            <span className="flex-1 text-[13px] font-normal truncate text-foreground/90 leading-none">{item.path}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
              {onStageFile && stageLabel && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-colors"
                  onClick={() => onStageFile(item.path)}
                  title={stageLabel}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
              {onUnstageFile && unstageLabel && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground transition-colors"
                  onClick={() => onUnstageFile(item.path)}
                  title={unstageLabel}
                >
                  <Minus className="w-3.5 h-3.5" />
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
    case 'unmerged':
      return <AlertTriangle className="w-4 h-4 text-destructive drop-shadow-[0_0_3px_rgba(239,68,68,0.3)]" />;
    default:
      return <File {...iconProps} />;
  }
}

export function FileList({ repoPath }: FileListProps) {
  const { currentStatus, stageFile, unstageFile, stageAll, unstageAll, selectedFile, selectFile, mergeState } = useRepoStore();

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
          selectedFile={selectedFile}
          onSelectFile={(file) => selectFile(repoPath, file)}
        />

        <FileSection
          title="工作区更改"
          files={currentStatus.unstaged}
          onStageFile={(file) => stageFile(repoPath, file)}
          onUnstageFile={() => {}}
          stageLabel="暂存文件"
          unstageLabel=""
          icon={<span className="text-[10px] font-black text-amber-500">M</span>}
          selectedFile={selectedFile}
          onSelectFile={(file) => selectFile(repoPath, file)}
        />

        <FileSection
          title="未跟踪文件"
          files={currentStatus.untracked}
          onStageFile={(file) => stageFile(repoPath, file)}
          onUnstageFile={() => {}}
          stageLabel="暂存文件"
          unstageLabel=""
          icon={<span className="text-[10px] font-black text-blue-500">U</span>}
          selectedFile={selectedFile}
          onSelectFile={(file) => selectFile(repoPath, file)}
        />

        {currentStatus.conflicted.length > 0 && (
          <div className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="flex items-center justify-center w-5 h-5 rounded bg-destructive/10 animate-pulse">
                <AlertTriangle className="w-3 h-3 text-destructive" />
              </div>
              <h3 className="text-[11px] font-semibold tracking-wide uppercase text-destructive">合并冲突</h3>
              <span className="text-[10px] text-destructive/60 font-mono">
                {currentStatus.conflicted.length}
              </span>
              {mergeState?.isMergeInProgress && (
                <span className="ml-auto text-[9px] text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded-full">
                  需要解决后才能提交
                </span>
              )}
            </div>
            <div className="space-y-[1px] rounded-lg overflow-hidden border-2 border-destructive/30 bg-destructive/5 backdrop-blur-sm">
              {currentStatus.conflicted.map((item, index) => (
                <div
                  key={`${item.path}-${index}`}
                  onClick={() => selectFile(repoPath, item.path)}
                  className={`group flex items-center gap-3 px-3 py-2.5 hover:bg-destructive/10 active:bg-destructive/20 transition-colors duration-100 cursor-pointer ${
                    selectedFile === item.path ? 'bg-destructive/15' : ''
                  }`}
                >
                  <div className="opacity-90 group-hover:opacity-100 transition-opacity">
                    <AlertTriangle className="w-4 h-4 text-destructive drop-shadow-[0_0_3px_rgba(239,68,68,0.3)]" />
                  </div>
                  <span className="flex-1 text-[13px] font-medium truncate text-destructive/90">{item.path}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                    <span className="text-[9px] text-destructive/70 bg-destructive/10 px-1.5 py-0.5 rounded">
                      未解决
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
