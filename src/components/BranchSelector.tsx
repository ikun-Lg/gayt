import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { GitBranch, Cloud, Check } from 'lucide-react';
import { useState } from 'react';

interface BranchSelectorProps {
  repoPath: string;
}

export function BranchSelector({ repoPath }: BranchSelectorProps) {
  const { currentBranchInfo, localBranches, switchBranch, publishBranch, loadLocalBranches } = useRepoStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const currentBranch = currentBranchInfo?.current || '';
  const isPublished = currentBranchInfo?.isPublished ?? false;

  const handleSwitchBranch = async (branchName: string) => {
    try {
      await switchBranch(repoPath, branchName);
      setIsOpen(false);
    } catch (e) {
      console.error('切换分支失败:', e);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishBranch(repoPath, currentBranch);
    } catch (e) {
      console.error('发布分支失败:', e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpen = () => {
    loadLocalBranches(repoPath);
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="gap-2"
      >
        <GitBranch className="w-4 h-4" />
        <span>{currentBranch}</span>
        {!isPublished && currentBranch && (
          <span className="text-xs text-muted-foreground">(未发布)</span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute z-20 top-full mt-1 w-64 max-h-80 overflow-y-auto">
            <div className="p-2 space-y-1">
              {localBranches.map((branch) => (
                <div
                  key={branch.name}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer group"
                  onClick={() => handleSwitchBranch(branch.name)}
                >
                  <div className="flex items-center gap-2">
                    {branch.isHead && <Check className="w-4 h-4 text-primary" />}
                    <span className="text-sm">{branch.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {branch.upstream && (
                      <Cloud className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isPublished && currentBranch && (
              <div className="border-t p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePublish();
                  }}
                  disabled={isPublishing}
                >
                  <Cloud className="w-4 h-4 mr-2" />
                  {isPublishing ? '发布中...' : '发布分支'}
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
