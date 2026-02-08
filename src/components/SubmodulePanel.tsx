import React from 'react';
import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Layers, RefreshCw, Play, Info } from 'lucide-react';
import { Badge } from './ui/Badge';

export const SubmodulePanel: React.FC = () => {
  const { selectedRepoPath, submodules, updateSubmodule, initSubmodule, loadSubmodules } = useRepoStore();

  if (!selectedRepoPath) return null;

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm border-l border-border/50 w-80">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Submodules</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => loadSubmodules(selectedRepoPath)}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {submodules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Layers className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">No submodules found</p>
          </div>
        ) : (
          submodules.map((sm) => (
            <Card key={sm.path} className="p-3 bg-secondary/30 border-border/40 hover:border-primary/30 transition-colors">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={sm.name}>
                      {sm.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate" title={sm.path}>
                      {sm.path}
                    </p>
                  </div>
                  <Badge variant={sm.status === 'in_sync' ? 'success' : sm.status === 'uninitialized' ? 'secondary' : 'secondary'} className="text-[10px] h-4">
                    {sm.status}
                  </Badge>
                </div>
                
                <div className="text-[10px] font-mono text-muted-foreground bg-background/40 p-1.5 rounded border border-border/20">
                  <div className="flex justify-between">
                    <span>Index:</span>
                    <span>{sm.indexId?.slice(0, 7) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span>HEAD:</span>
                    <span>{sm.headId?.slice(0, 7) || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {sm.status === 'uninitialized' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-[11px]"
                      onClick={() => initSubmodule(selectedRepoPath)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Init
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-[11px]"
                      onClick={() => updateSubmodule(selectedRepoPath)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Update
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-border/40 bg-secondary/10">
        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Submodule updates run recursive update and init commands.
        </p>
      </div>
    </div>
  );
};
