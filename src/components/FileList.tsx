import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Plus, Minus, File, FilePlus, FileMinus, FileEdit, GitBranch, AlertTriangle, Trash2, GripVertical, Search, X } from 'lucide-react';
import type { FileStatus, StatusItem } from '../types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Input } from './ui/Input';

interface FileListProps {
  repoPath: string;
}

interface SortableFileItem {
  id: string;
  file: StatusItem;
  section: 'staged' | 'unstaged' | 'untracked';
}

interface FileSectionProps {
  title: string;
  files: StatusItem[];
  section: 'staged' | 'unstaged' | 'untracked';
  onStageFile: (file: string) => void;
  onUnstageFile: (file: string) => void;
  onDiscardFile?: (file: string) => void;
  stageLabel: string;
  unstageLabel: string;
  discardLabel?: string;
  icon: React.ReactNode;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

function SortableFileRow({
  item,
  isSelected,
  onStage,
  onUnstage,
  onDiscard,
  stageLabel,
  unstageLabel,
  discardLabel,
}: {
  item: SortableFileItem;
  isSelected: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  stageLabel: string;
  unstageLabel: string;
  discardLabel?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: item,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 hover:bg-accent/10 active:bg-accent/20 transition-colors duration-100 cursor-default",
        isSelected && "bg-accent/20",
        isDragging && "bg-accent/10 ring-2 ring-primary/20 rounded-lg"
      )}
      onClick={() => !isDragging /* Prevent click when dragging */}
    >
      {/* Drag handle */}
      <button
        className="opacity-0 group-hover:opacity-30 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 -ml-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="opacity-70 group-hover:opacity-100 transition-opacity">
        <FileIcon status={item.file.status} />
      </div>
      <span className="flex-1 text-[13px] font-normal truncate text-foreground/90 leading-none select-none" title={item.file.path}>{item.file.path}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        {onStage && stageLabel && (
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground transition-colors"
            onClick={(e) => { e.stopPropagation(); onStage(); }}
            title={stageLabel}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
        {onUnstage && unstageLabel && (
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground transition-colors"
            onClick={(e) => { e.stopPropagation(); onUnstage(); }}
            title={unstageLabel}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
        )}
        {onDiscard && discardLabel && (
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 hover:bg-red-500/10 hover:text-red-500 rounded text-muted-foreground transition-colors"
            onClick={(e) => { e.stopPropagation(); onDiscard(); }}
            title={discardLabel}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FileSection({
  title,
  files,
  section,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  stageLabel,
  unstageLabel,
  discardLabel,
  icon,
  selectedFile,
  onSelectFile,
}: FileSectionProps) {
  const items: SortableFileItem[] = React.useMemo(() => 
    files.map((file) => ({ id: `${section}-${file.path}`, file, section })),
    [files, section]
  );

  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section}`,
    data: { section },
  });

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-2 px-2 opacity-70 group hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-secondary/50">
          {icon}
        </div>
        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{title}</h3>
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {items.length}
        </span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={cn(
           "space-y-[1px] rounded-lg overflow-hidden border border-border/50 bg-card/40 backdrop-blur-sm min-h-[40px] transition-colors",
           isOver && "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.length === 0 && (
                <div className="p-4 flex items-center justify-center text-[10px] text-muted-foreground/40 italic select-none">
                    拖拽文件到这里
                </div>
            )}
            {items.map((item) => (
              <div key={item.id} onClick={() => onSelectFile(item.file.path)}>
                <SortableFileRow
                    item={item}
                    isSelected={selectedFile === item.file.path}
                    onStage={
                    section !== 'staged'
                        ? () => onStageFile(item.file.path)
                        : undefined
                    }
                    onUnstage={
                    section === 'staged'
                        ? () => onUnstageFile(item.file.path)
                        : undefined
                    }
                    onDiscard={
                    section !== 'staged' && onDiscardFile
                        ? () => onDiscardFile(item.file.path)
                        : undefined
                    }
                    stageLabel={stageLabel}
                    unstageLabel={unstageLabel}
                    discardLabel={discardLabel}
                />
              </div>
            ))}
        </SortableContext>
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
      return <File className="w-4 h-4 text-primary drop-shadow-sm" />;
    case 'unmerged':
      return <AlertTriangle className="w-4 h-4 text-destructive drop-shadow-[0_0_3px_rgba(239,68,68,0.3)]" />;
    default:
      return <File {...iconProps} />;
  }
}

export function FileList({ repoPath }: FileListProps) {
  const { currentStatus, stageFile, unstageFile, discardFile, stageAll, unstageAll, selectedFile, selectFile, mergeState } = useRepoStore();
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    // active.data.current.section is source
    // over.data.current.section is target
    const sourceData = active.data.current as SortableFileItem | undefined;
    const targetData = over.data.current as { section: 'staged' | 'unstaged' | 'untracked' } | undefined;

    if (!sourceData || !targetData) return;

    const sourceSection = sourceData.section;
    const targetSection = targetData.section;

    if (sourceSection === targetSection) return;

    const filePath = sourceData.file.path;

    if (targetSection === 'staged') {
        stageFile(repoPath, filePath);
    } else {
        // Moving to unstaged or untracked means unstaging
        unstageFile(repoPath, filePath);
    }
  }

  // Filter files based on search query
  const filteredStatus = useMemo(() => {
    if (!currentStatus) return null;
    if (!searchQuery.trim()) return currentStatus;

    const query = searchQuery.toLowerCase();
    const filterFn = (item: StatusItem) => item.path.toLowerCase().includes(query);

    return {
      ...currentStatus,
      staged: currentStatus.staged.filter(filterFn),
      unstaged: currentStatus.unstaged.filter(filterFn),
      untracked: currentStatus.untracked.filter(filterFn),
      conflicted: currentStatus.conflicted.filter(filterFn),
    };
  }, [currentStatus, searchQuery]);

  if (!currentStatus || !filteredStatus) {
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

  if (totalFiles === 0 && !searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p>工作区干净</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background selection:bg-primary/20">
      {/* Header with Actions and Search */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center gap-3">
            <Button
            size="sm"
            onClick={() => stageAll(repoPath)}
            className="rounded-xl px-4 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all duration-300 btn-tactile flex-1"
            >
            <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
            全部暂存
            </Button>
            <Button
            size="sm"
            variant="secondary"
            onClick={() => unstageAll(repoPath)}
            className="rounded-xl px-4 font-bold bg-muted/50 hover:bg-muted active:scale-95 transition-all duration-200 btn-tactile flex-1"
            >
            <Minus className="w-4 h-4 mr-2 stroke-[3px]" />
            全部取消
            </Button>
        </div>

        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件..."
            className="pl-8 h-8 text-xs bg-muted/30 border-transparent hover:bg-muted/50 focus:bg-background transition-colors rounded-lg"
            />
            {searchQuery && (
            <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
                <X className="w-3 h-3" />
            </button>
            )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-2">
                {(filteredStatus.staged.length > 0 || searchQuery) && (
                  <FileSection
                  title="已暂存区域"
                  files={filteredStatus.staged}
                  section="staged"
                  onStageFile={() => {}}
                  onUnstageFile={(file) => unstageFile(repoPath, file)}
                  stageLabel=""
                  unstageLabel="取消暂存"
                  icon={<span className="text-[10px] font-black text-green-500">S</span>}
                  selectedFile={selectedFile}
                  onSelectFile={(file) => selectFile(repoPath, file)}
                  />
                )}

                {(filteredStatus.unstaged.length > 0 || searchQuery) && (
                  <FileSection
                  title="工作区更改"
                  files={filteredStatus.unstaged}
                  section="unstaged"
                  onStageFile={(file) => stageFile(repoPath, file)}
                  onUnstageFile={() => {}}
                  onDiscardFile={(file) => discardFile(repoPath, file)}
                  stageLabel="暂存文件"
                  unstageLabel=""
                  discardLabel="放弃变更"
                  icon={<span className="text-[10px] font-black text-amber-500">M</span>}
                  selectedFile={selectedFile}
                  onSelectFile={(file) => selectFile(repoPath, file)}
                  />
                )}

                {(filteredStatus.untracked.length > 0 || searchQuery) && (
                  <FileSection
                  title="未跟踪文件"
                  files={filteredStatus.untracked}
                  section="untracked"
                  onStageFile={(file) => stageFile(repoPath, file)}
                  onUnstageFile={() => {}}
                  onDiscardFile={(file) => discardFile(repoPath, file)}
                  stageLabel="暂存文件"
                  unstageLabel=""
                  discardLabel="删除文件"
                  icon={<span className="text-[10px] font-black text-primary">U</span>}
                  selectedFile={selectedFile}
                  onSelectFile={(file) => selectFile(repoPath, file)}
                  />
                )}
            </div>
        </DndContext>

        {filteredStatus.conflicted.length > 0 && (
          <div className="mb-6 last:mb-0 mt-6">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="flex items-center justify-center w-5 h-5 rounded bg-destructive/10 animate-pulse">
                <AlertTriangle className="w-3 h-3 text-destructive" />
              </div>
              <h3 className="text-[11px] font-semibold tracking-wide uppercase text-destructive">合并冲突</h3>
              <span className="text-[10px] text-destructive/60 font-mono">
                {filteredStatus.conflicted.length}
              </span>
              {mergeState?.isMergeInProgress && (
                <span className="ml-auto text-[9px] text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded-full">
                  需要解决后才能提交
                </span>
              )}
            </div>
            <div className="space-y-[1px] rounded-lg overflow-hidden border-2 border-destructive/30 bg-destructive/5 backdrop-blur-sm">
              {filteredStatus.conflicted.map((item, index) => (
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
        
        {searchQuery && 
         filteredStatus.staged.length === 0 && 
         filteredStatus.unstaged.length === 0 && 
         filteredStatus.untracked.length === 0 && 
         filteredStatus.conflicted.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/50 text-xs">
                没有找到匹配的文件
            </div>
        )}
      </div>
    </div>
  );
}
