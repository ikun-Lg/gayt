import { useRepoStore } from '../store/repoStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

interface CommitPanelProps {
  repoPath: string | string[];
  mode: 'single' | 'batch';
}

export function CommitPanel({ repoPath, mode }: CommitPanelProps) {
  const { currentStatus, commit, batchCommit, generateCommitMessage } = useRepoStore();
  const { commitLanguage } = useSettingsStore();
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const hasStaged = currentStatus && currentStatus.staged.length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const paths = Array.isArray(repoPath) ? repoPath : [repoPath];
      const path = paths[0];
      const suggestion = await generateCommitMessage(path);
      setMessage(suggestion.formatted);
    } catch (e) {
      console.error('生成消息失败:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommit = async () => {
    if (!message.trim()) return;

    setIsCommitting(true);
    try {
      if (mode === 'single') {
        await commit(repoPath as string, message);
      } else {
        await batchCommit(repoPath as string[], message);
      }
      setMessage('');
    } catch (e) {
      console.error('提交失败:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  const getPlaceholder = () => {
    if (commitLanguage === 'zh') {
      return 'feat: 添加新功能';
    }
    return 'feat: add new feature';
  };

  return (
    <div className="p-6 bg-background/50 border-t backdrop-blur-md">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">提交信息</label>
              <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              <span className={cn(
                "text-[10px] font-mono font-bold",
                message.length > 50 ? "text-amber-500" : "text-muted-foreground/50"
              )}>
                {message.length}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleGenerate}
              disabled={isGenerating || !hasStaged}
              className="h-7 text-[11px] font-bold bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 transition-all duration-200 btn-tactile animate-float"
            >
              <Sparkles className={cn("w-3.5 h-3.5 mr-1.5", isGenerating && "animate-pulse")} />
              {isGenerating ? 'AI 解析中...' : 'AI 智能生成'}
            </Button>
          </div>
          <textarea
            id="commit-message-input"
            className={cn(
              "w-full min-h-[80px] p-4 text-sm bg-background border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 outline-none resize-none no-scrollbar shadow-inner",
              !message && "italic"
            )}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={getPlaceholder()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleCommit();
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full h-11 font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 btn-tactile"
            onClick={handleCommit}
            disabled={!hasStaged || !message.trim() || isCommitting}
          >
            <Check className="w-4.5 h-4.5 mr-2 stroke-[3px]" />
            {isCommitting
              ? '提交中...'
              : mode === 'single'
              ? '提交更改到本地仓库'
              : `批量提交到 ${Array.isArray(repoPath) ? repoPath.length : 1} 个仓库`}
          </Button>

          {currentStatus && (
            <div key={currentStatus.staged.length} className="flex items-center justify-center gap-2 text-[11px] font-medium text-muted-foreground/60 animate-pop">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
              {currentStatus.staged.length} 个文件已准备就绪
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
