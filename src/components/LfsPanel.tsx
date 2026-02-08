import React, { useState } from 'react';
import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Database, Plus, RefreshCw, XCircle, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Input } from './ui/Input';

export const LfsPanel: React.FC = () => {
  const { selectedRepoPath, lfsStatus, loadLfsStatus, lfsTrack, lfsUntrack } = useRepoStore();
  const [newPattern, setNewPattern] = useState('');

  if (!selectedRepoPath) return null;

  const handleTrack = async () => {
    if (newPattern.trim()) {
      await lfsTrack(selectedRepoPath, newPattern.trim());
      setNewPattern('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm border-l border-border/50 w-80">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Git LFS</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => loadLfsStatus(selectedRepoPath)}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="p-4 border-b border-border/40 space-y-3">
        <div className="flex items-center gap-2 p-2 rounded bg-secondary/30 border border-border/40">
          {lfsStatus?.isInstalled ? (
            <ShieldCheck className="w-4 h-4 text-success" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-warning" />
          )}
          <span className="text-xs font-medium">
            LFS {lfsStatus?.isInstalled ? 'Installed' : 'Not Detected'}
          </span>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="*.psd, bin/"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="h-8 text-xs bg-background/50"
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          />
          <Button size="sm" className="h-8 shrink-0 px-2" onClick={handleTrack}>
            <Plus className="w-3 h-3 mr-1" />
            Track
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h3 className="text-[10px] font-uppercase font-semibold text-muted-foreground tracking-wider mb-2">TRACKED PATTERNS</h3>
        {lfsStatus?.trackedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Database className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">No LFS patterns tracked</p>
          </div>
        ) : (
          lfsStatus?.trackedFiles.map((pattern) => (
            <Card key={pattern} className="p-2 bg-secondary/30 border-border/40 flex items-center justify-between">
              <span className="text-xs font-mono">{pattern}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:text-destructive"
                onClick={() => lfsUntrack(selectedRepoPath, pattern)}
              >
                <XCircle className="w-3 h-3" />
              </Button>
            </Card>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border/40 bg-secondary/10">
        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          LFS commands update .gitattributes with your tracked patterns.
        </p>
      </div>
    </div>
  );
};
