import { useState, useEffect } from 'react';
import { useProviderStore } from '../store/providerStore';
import { Button } from './ui/Button';
import { RefreshCw, X, Copy, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

interface CILogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  jobId: string;
  jobName: string;
}

export function CILogsDialog({ isOpen, onClose, repoPath, jobId, jobName }: CILogsDialogProps) {
  const { fetchJobLogs } = useProviderStore();
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      loadLogs();
    }
  }, [isOpen, jobId]);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const content = await fetchJobLogs(repoPath, jobId);
      setLogs(content);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-border/50 shadow-2xl rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2 rounded-lg">
                <Terminal className="w-5 h-5 text-primary" />
             </div>
             <div>
                <h3 className="text-lg font-semibold text-foreground">CI 日志: {jobName}</h3>
                <p className="text-xs text-muted-foreground font-mono">Job ID: {jobId}</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={loadLogs} disabled={isLoading} title="刷新">
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(logs)} disabled={!logs} title="复制日志">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 bg-black/5 flex flex-col">
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20">
              <RefreshCw className="w-10 h-10 animate-spin mb-4 opacity-20" />
              <p className="text-sm">正在获取日志内容...</p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-destructive/10 p-4 rounded-full mb-4">
                    <X className="w-8 h-8 text-destructive" />
                </div>
                <h4 className="text-lg font-medium mb-2">获取日志失败</h4>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">{error}</p>
                <Button onClick={loadLogs}>重试</Button>
            </div>
          )}

          {!isLoading && !error && (
            <pre className="p-6 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap flex-1 custom-scrollbar">
              {logs || '无日志内容'}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end">
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  );
}
