import { useRepoStore } from '../store/repoStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { Sparkles, Bot, X, Archive } from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { isShortcutMatch } from '../lib/shortcuts';

interface CommitPanelProps {
  repoPath: string | string[];
  mode: 'single' | 'batch';
}

export function CommitPanel({ repoPath, mode }: CommitPanelProps) {
  const { currentStatus, commit, batchCommit, generateCommitMessage, reviewCode, stashSave } = useRepoStore();
  const { commitLanguage, shortcuts } = useSettingsStore();
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Review state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

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

  const handleReview = async () => {
    setIsReviewing(true);
    setReviewResult(null);
    setShowReview(true);
    try {
      const paths = Array.isArray(repoPath) ? repoPath : [repoPath];
      const path = paths[0];
      const result = await reviewCode(path);
      setReviewResult(result.content);
    } catch (e) {
      console.error('代码审查失败:', e);
      setReviewResult('代码审查失败，请检查 API Key 配置或网络连接。');
    } finally {
      setIsReviewing(false);
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
      setReviewResult(null);
      setShowReview(false);
    } catch (e) {
      console.error('提交失败:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  const [isStashing, setIsStashing] = useState(false);
  const handleStash = async () => {
    const paths = Array.isArray(repoPath) ? repoPath : [repoPath];
    const path = paths[0];
    
    setIsStashing(true);
    try {
      await stashSave(path, message || undefined, true);
      setMessage('');
    } catch (e) {
      console.error('Stash failed:', e);
    } finally {
      setIsStashing(false);
    }
  };

  const getPlaceholder = () => {
    if (commitLanguage === 'zh') {
      return 'feat: 添加新功能';
    }
    return 'feat: add new feature';
  };

  return (
    <div className="p-4 bg-background/30 border-t border-border/50 backdrop-blur-md flex flex-col gap-3">
      <div className="max-w-4xl mx-auto w-full space-y-3">
        {/* Review Result Area */}
        {showReview && (
          <div className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-card/80 backdrop-blur-xl rounded-lg border shadow-lg p-4 relative ring-1 ring-border/50">
              <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Bot className="w-3.5 h-3.5" />
                  AI 智能审查
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 rounded-full hover:bg-muted"
                  onClick={() => setShowReview(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                {isReviewing ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground/50">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>正在分析变更...</span>
                  </div>
                ) : (
                  <div className="markdown-content text-sm text-foreground/90">
                    <Markdown>{reviewResult || "未发现问题。"}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
               {/* Use a simple character count or a cleaner label */}
               {message.length > 0 && (
                <span className={cn(
                  "text-[10px] font-mono",
                  message.length > 50 ? "text-amber-500" : "text-muted-foreground/60"
                )}>{message.length}</span>
               )}
            </div>
            
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReview}
                disabled={isReviewing || !hasStaged}
                className="h-6 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground hover:text-primary transition-colors hover:bg-transparent px-2"
              >
                <Bot className={cn("w-3 h-3 mr-1.5", isReviewing && "animate-spin")} />
                智能审查
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleGenerate}
                disabled={isGenerating || !hasStaged}
                className="h-6 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground hover:text-primary transition-colors hover:bg-transparent px-2"
              >
                <Sparkles className={cn("w-3 h-3 mr-1.5", isGenerating && "animate-pulse")} />
                智能生成
              </Button>
            </div>
          </div>
          
          <div className="relative group">
            <textarea
              id="commit-message-input"
              className={cn(
                "w-full min-h-[70px] p-3 text-sm bg-background/50 border border-border/60 rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all duration-200 outline-none resize-none no-scrollbar placeholder:text-muted-foreground/40",
                !message && "italic"
              )}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={getPlaceholder()}
              onKeyDown={(e) => {
                const commitShortcut = shortcuts['commit'];
                if (commitShortcut && isShortcutMatch(e.nativeEvent, commitShortcut)) {
                  e.preventDefault();
                  handleCommit();
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                   // Fallback to default if 'commit' shortcut is not defined (should not happen with defaults)
                   handleCommit();
                }
              }}
            />
            {/* Corner action button could go here if needed, but keeping it below for clarity */}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 h-9 font-medium text-xs rounded-lg shadow-sm active:scale-[0.99] transition-all duration-200"
            onClick={handleCommit}
            disabled={!hasStaged || !message.trim() || isCommitting}
          >
            {isCommitting ? (
              <span className="flex items-center gap-2">
                 <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 提交中...
              </span>
            ) : (
                mode === 'single' ? '确认提交' : `批量提交 (${Array.isArray(repoPath) ? repoPath.length : 1} 个项目)`
            )}
          </Button>

          {mode === 'single' && (
            <Button
              variant="outline"
              className="h-9 px-3 font-medium text-xs rounded-lg shadow-sm active:scale-[0.99] transition-all duration-200 border-border/60 hover:bg-secondary/50"
              onClick={handleStash}
              disabled={isStashing || (!currentStatus?.unstaged.length && !currentStatus?.untracked.length && !currentStatus?.staged.length)}
              title="贮存当前更改"
            >
              {isStashing ? (
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
