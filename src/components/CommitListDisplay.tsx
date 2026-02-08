import { useRepoStore } from '../store/repoStore';
import { CommitGraph } from './CommitGraph';
import { VirtualizedCommitList } from './VirtualizedCommitList';
import { GitGraph, SearchX } from 'lucide-react';

interface CommitListDisplayProps {
    repoPath: string;
    showGraph: boolean;
}

export function CommitListDisplay({ repoPath, showGraph }: CommitListDisplayProps) {
    const { 
        commitHistory, 
        searchResults, 
        isSearching, 
        loadMoreCommits, 
        hasMoreCommits, 
        isLoadingMoreCommits 
    } = useRepoStore();

    // Determine what to display
    // If searchResults is not null, we are in search mode (even if empty results)
    const isSearchMode = searchResults !== null;
    const commitsToDisplay = isSearchMode ? searchResults : commitHistory;

    if (isSearching) {
         return (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-pulse">
                 <GitGraph className="w-10 h-10 mb-3 opacity-20 animate-bounce" />
                 <p>正在搜索提交...</p>
             </div>
         );
    }

    if (commitsToDisplay.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                {isSearchMode ? (
                     <>
                        <SearchX className="w-10 h-10 mb-3 opacity-20" />
                        <p>未找到匹配的提交</p>
                     </>
                ) : (
                    <>
                        <GitGraph className="w-10 h-10 mb-3 opacity-20" />
                        <p>暂无提交记录</p>
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            {showGraph && !isSearchMode && (
                <CommitGraph commits={commitsToDisplay} rowHeight={56} />
            )}

            <VirtualizedCommitList
                repoPath={repoPath}
                commits={commitsToDisplay}
                rowHeight={56}
                showGraph={showGraph && !isSearchMode} // Disable graph lines for search results as they might be disjointed
                graphWidth={showGraph && !isSearchMode ? 80 : 0}
                onLoadMore={() => !isSearchMode && loadMoreCommits(repoPath)} // Disable load more for search results for now
                hasMore={!isSearchMode && hasMoreCommits}
                isLoadingMore={!isSearchMode && isLoadingMoreCommits}
            />
        </>
    );
}
