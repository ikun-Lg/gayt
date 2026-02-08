import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CommitInfo } from '../types';
import { GitCommit } from 'lucide-react';
import { Button } from './ui/Button';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Badge } from './ui/Badge';
import { CommitCIStatus } from './CommitCIStatus';

interface VirtualizedCommitListProps {
  repoPath: string;
  commits: CommitInfo[];
  rowHeight: number;
  showGraph?: boolean;
  graphWidth?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function VirtualizedCommitList({
  repoPath,
  commits,
  rowHeight,
  showGraph = false,
  graphWidth = 0,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: VirtualizedCommitListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoize graph width to avoid recalculation
  const effectiveGraphWidth = useMemo(() => {
    return showGraph ? Math.max(graphWidth, 80) : 0;
  }, [showGraph, graphWidth]);

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Handle scroll-based infinite loading
  const handleScroll = useCallback(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when scrolled to 80% of the list
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoadingMore]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className="h-full overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const commit = commits[virtualRow.index];
          if (!commit) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <CommitItem
                repoPath={repoPath}
                commit={commit}
                graphOffset={effectiveGraphWidth}
              />
            </div>
          );
        })}
      </div>

      {/* Loading indicator at the bottom */}
      {hasMore && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          {isLoadingMore ? '加载更多提交...' : '向下滚动加载更多'}
        </div>
      )}
    </div>
  );
}

interface CommitItemProps {
  repoPath: string;
  commit: CommitInfo;
  graphOffset: number;
}

function CommitItem({ repoPath, commit, graphOffset }: CommitItemProps) {
  return (
    <div className="relative flex items-center gap-4 px-4 hover:bg-muted/30 transition-colors group">
      {/* Graph offset space */}
      {graphOffset > 0 && <div style={{ width: graphOffset }} />}

      {/* Commit info */}
      <div className="flex-1 min-w-0 py-2">
        <div className="flex items-baseline gap-2 mb-0.5">
          {commit.refs && commit.refs.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {commit.refs.map((ref) => (
                <Badge key={ref} variant="outline" className="h-4 text-[9px] px-1 py-0 border-primary/30 text-primary bg-primary/5">
                  {ref}
                </Badge>
              ))}
            </div>
          )}
          <span className="text-sm font-medium truncate text-foreground/90">
            {commit.message}
          </span>
          <CommitCIStatus repoPath={repoPath} sha={commit.id} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <span className="font-mono text-[10px] opacity-70">{commit.shortId}</span>
          <span>•</span>
          <span>{commit.author}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(commit.timestamp * 1000), { addSuffix: true, locale: zhCN })}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => navigator.clipboard.writeText(commit.id)}
          title="复制 Hash"
        >
          <GitCommit className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
