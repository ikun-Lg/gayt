
import { useRepoStore } from '../store/repoStore';
import { Tag, Trash2, UploadCloud, Plus, GitCommit } from 'lucide-react';
import { Button } from './ui/Button';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useState } from 'react';
import { CreateTagDialog } from './CreateTagDialog';
import { cn } from '../lib/utils';
import { confirm } from '@tauri-apps/plugin-dialog';

export function TagList() {
  const { 
    tags, 
    selectedRepoPath, 
    currentBranchInfo,
    deleteTag, 
    pushTag, 
    createTag 
  } = useRepoStore();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [pushingTag, setPushingTag] = useState<string | null>(null);

  if (!selectedRepoPath) return null;

  const handleDelete = async (tagName: string) => {
    const confirmed = await confirm(`确定要删除标签 ${tagName} 吗？`, {
      title: '删除标签',
      kind: 'warning',
    });
    
    if (confirmed) {
       await deleteTag(selectedRepoPath, tagName);
    }
  };

  const handlePush = async (tagName: string) => {
    setPushingTag(tagName);
    try {
      await pushTag(selectedRepoPath, tagName);
    } catch (e) {
      console.error(e);
      // TODO: show error toast
    } finally {
      setPushingTag(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/20">
        <h3 className="text-sm font-medium flex items-center gap-2 text-foreground/80">
          <Tag className="w-3.5 h-3.5" />
          标签 <span className="text-muted-foreground ml-1 text-xs">({tags.length})</span>
        </h3>
        <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 px-2 hover:bg-background shadow-none border border-transparent hover:border-border/50"
            onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tags.map(tag => (
          <div key={tag.name} className="flex flex-col p-3 rounded-lg border border-transparent hover:border-border/40 hover:bg-accent/40 transition-all group">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-primary/70 mt-0.5" />
                    <span className="font-mono font-bold text-sm text-primary">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handlePush(tag.name)}
                        disabled={pushingTag === tag.name}
                        title="推送到远程"
                    >
                        <UploadCloud className={cn("w-3.5 h-3.5", pushingTag === tag.name && "animate-bounce")} />
                    </Button>
                    
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(tag.name)}
                        title="删除标签"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
            
            {tag.message && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-5.5 border-l-2 border-primary/10 ml-1">
                  {tag.message}
                </p>
            )}

            <div className="flex items-center gap-3 mt-2 pl-5.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/20">
                    <GitCommit className="w-3 h-3" />
                    <span className="font-mono">{tag.target.substring(0, 7)}</span>
                </div>

                <div className="text-[10px] text-muted-foreground/60 flex items-center gap-2">
                    {tag.tagger && <span>{tag.tagger}</span>}
                    {tag.date && (
                    <span>
                        {formatDistanceToNow(new Date(tag.date * 1000), { addSuffix: true, locale: zhCN })}
                    </span>
                    )}
                </div>
            </div>
          </div>
        ))}

        {tags.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
            <Tag className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-xs">暂无标签</p>
          </div>
        )}
      </div>

      <CreateTagDialog 
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={(name, message, target) => createTag(selectedRepoPath, name, message, target)}
        currentHead={currentBranchInfo?.current || 'HEAD'}
      />
    </div>
  );
}
