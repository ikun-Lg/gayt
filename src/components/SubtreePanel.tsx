import React, { useState } from 'react';
import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Share2, Plus, Info, RefreshCw, X } from 'lucide-react';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

export const SubtreePanel: React.FC = () => {
  const { selectedRepoPath, subtrees, addSubtree, loadSubtrees } = useRepoStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ prefix: '', remote: '', branch: 'main' });

  if (!selectedRepoPath) return null;

  const handleAdd = async () => {
    if (formData.prefix && formData.remote && formData.branch) {
      await addSubtree(selectedRepoPath, formData.prefix, formData.remote, formData.branch);
      setShowAddForm(false);
      setFormData({ prefix: '', remote: '', branch: 'main' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm border-l border-border/50 w-80">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Subtrees</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => loadSubtrees(selectedRepoPath)}
          >
            <RefreshCw className="w-3 h-3" />
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-border/40 bg-secondary/20 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="prefix" className="text-[10px] uppercase font-semibold text-muted-foreground">Prefix Path</Label>
            <Input 
              id="prefix" 
              placeholder="e.g., vendor/lib" 
              value={formData.prefix}
              className="h-8 text-xs bg-background/50"
              onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="remote" className="text-[10px] uppercase font-semibold text-muted-foreground">Remote URL</Label>
            <Input 
              id="remote" 
              placeholder="https://github.com/user/repo.git" 
              value={formData.remote}
              className="h-8 text-xs bg-background/50"
              onChange={(e) => setFormData({ ...formData, remote: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="branch" className="text-[10px] uppercase font-semibold text-muted-foreground">Branch</Label>
            <Input 
              id="branch" 
              value={formData.branch}
              className="h-8 text-xs bg-background/50"
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            />
          </div>
          <Button variant="default" size="sm" className="w-full h-8 mt-2" onClick={handleAdd}>
            Add Subtree
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {subtrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Share2 className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">No subtrees detected</p>
          </div>
        ) : (
          subtrees.map((st) => (
            <Card key={st.prefix} className="p-3 bg-secondary/30 border-border/40 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {st.prefix}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {st.remote !== 'unknown' ? st.remote : 'No remote metadata found'}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border/40 bg-secondary/10">
        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Subtrees are embedded repositories, managed without submodule friction.
        </p>
      </div>
    </div>
  );
};
