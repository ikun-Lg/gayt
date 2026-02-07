import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { GitBranch } from 'lucide-react';

interface CreateBranchDialogProps {
  isOpen: boolean;
  baseBranch: string;
  onClose: () => void;
  onCreate: (newBranchName: string) => Promise<void>;
}

export function CreateBranchDialog({ isOpen, baseBranch, onClose, onCreate }: CreateBranchDialogProps) {
  const [branchName, setBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBranchName('');
      setError(null);
      // Focus input after a short delay to allow rendering
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!branchName.trim()) {
      setError('请输入分支名称');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(branchName.trim());
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200">
      <Card className="w-full max-w-sm p-6 shadow-2xl border-white/20 bg-background/95 backdrop-blur-xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-2 bg-primary/10 rounded-lg">
              <GitBranch className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">新建分支</h2>
          </div>
          
          <p className="text-sm text-muted-foreground">
            基于 <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{baseBranch}</span> 创建新分支
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                ref={inputRef}
                value={branchName}
                onChange={(e) => {
                  setBranchName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="输入新分支名称..."
                className="h-10 bg-background/50"
                disabled={isCreating}
              />
              {error && (
                <p className="text-xs text-destructive font-medium animate-in slide-in-from-top-1">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isCreating}
                className="hover:bg-muted"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!branchName.trim() || isCreating}
              >
                {isCreating ? '创建中...' : '创建分支'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
