import { useEffect, useMemo, useState } from 'react';
import { useProviderStore } from '../store/providerStore';
import { useSettingsStore } from '../store/settingsStore';
import { CheckCircle2, XCircle, Clock, ExternalLink, Terminal } from 'lucide-react';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/Tooltip";
import { Button } from './ui/Button';
import { CILogsDialog } from './CILogsDialog';

interface CommitCIStatusProps {
    repoPath: string;
    sha: string;
}

export function CommitCIStatus({ repoPath, sha }: CommitCIStatusProps) {
    const { commitStatuses, loadCommitStatus } = useProviderStore();
    const { githubToken, gitlabToken } = useSettingsStore();
    const statuses = commitStatuses[sha];
    const hasToken = !!(githubToken || gitlabToken);

    const [selectedJob, setSelectedJob] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (!statuses && hasToken) {
            loadCommitStatus(repoPath, sha);
        }
    }, [repoPath, sha, statuses, hasToken, loadCommitStatus]);

    const combinedStatus = useMemo(() => {
        if (!statuses || statuses.length === 0) return 'none';
        
        if (statuses.some(s => s.status === 'failure' || s.status === 'failed' || s.status === 'error' || s.status === 'action_required' || s.status === 'cancelled' || s.status === 'timed_out')) {
            return 'failure';
        }
        
        if (statuses.some(s => s.status === 'pending' || s.status === 'running' || s.status === 'in_progress' || s.status === 'queued')) {
            return 'pending';
        }

        if (statuses.every(s => s.status === 'success' || s.status === 'completed' || s.status === 'passed' || s.status === 'neutral' || s.status === 'skipped')) {
            return 'success';
        }

        return 'unknown';
    }, [statuses]);

    if (!hasToken || !statuses) return null;

    const StatusIcon = () => {
        switch (combinedStatus) {
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'failure':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
            default:
                return <Clock className="w-4 h-4 text-muted-foreground opacity-50" />;
        }
    };

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center cursor-help">
                            <StatusIcon />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="w-64 p-0 overflow-hidden border-border/40">
                        <div className="bg-muted/50 px-3 py-2 border-b border-border/40 flex items-center justify-between">
                            <span className="text-xs font-medium">CI 状态</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{sha.substring(0, 7)}</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {statuses.map((s, i) => (
                                <div key={i} className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <StatusSmallIcon status={s.status} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[11px] font-medium truncate" title={s.name}>{s.name}</span>
                                            {s.description && <span className="text-[10px] text-muted-foreground truncate">{s.description}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                            onClick={() => setSelectedJob({ id: s.id, name: s.name })}
                                            title="查看日志"
                                        >
                                            <Terminal className="w-3 h-3" />
                                        </Button>
                                        {s.url && (
                                            <a 
                                                href={s.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary p-1"
                                                title="在浏览器中打开"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {selectedJob && (
                <CILogsDialog 
                    isOpen={!!selectedJob}
                    onClose={() => setSelectedJob(null)}
                    repoPath={repoPath}
                    jobId={selectedJob.id}
                    jobName={selectedJob.name}
                />
            )}
        </>
    );
}

function StatusSmallIcon({ status }: { status: string }) {
    const s = status.toLowerCase();
    if (s === 'success' || s === 'completed' || s === 'passed') {
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    }
    if (s === 'failure' || s === 'failed' || s === 'error') {
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
    if (s === 'pending' || s === 'running' || s === 'in_progress' || s === 'queued') {
        return <Clock className="w-3 h-3 text-yellow-500 animate-pulse" />;
    }
    return <Clock className="w-3 h-3 text-muted-foreground opacity-50" />;
}
