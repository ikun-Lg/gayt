import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { useRepoStore } from '../store/repoStore';
import { listen } from '@tauri-apps/api/event';
import { Loader2, X, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface CloneDialogProps {
  onClose: () => void;
  isOpen: boolean;
}

interface CloneProgress {
  total_objects: number;
  indexed_objects: number;
  received_objects: number;
  local_objects: number;
  total_deltas: number;
  indexed_deltas: number;
  received_bytes: number;
}

export function CloneDialog({ onClose, isOpen }: CloneDialogProps) {
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  
  const { cloneRepository } = useRepoStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<CloneProgress>('clone-progress', (event) => {
        setProgress(event.payload);
      });
    };

    if (isOpen) {
      setupListener();
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen]);

  const handleBrowseDestination = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择克隆目标文件夹',
      });
      
      if (selected && typeof selected === 'string') {
        setDestination(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClone = async () => {
    if (!url || !destination) {
      setError('请输入仓库 URL 和目标路径');
      return;
    }

    setIsCloning(true);
    setError(null);
    setProgress(null);

    // Auto-append repo name to destination if not present
    let finalDestination = destination;
    const repoName = url.split('/').pop()?.replace('.git', '') || 'repository';
    if (!finalDestination.endsWith(repoName)) {
        // Checking if destination is just a directory where we want to put the repo folder
        // For simplicity, let's assume the user picks the PARENT directory, so we append the repo name
        // But the dialog usually expects the full path. 
        // Let's assume user picked the PARENT directory.
        // We will append the repo name to it.
        if (!finalDestination.endsWith('/')) {
            finalDestination += '/';
        }
        finalDestination += repoName;
    }

    try {
      await cloneRepository(url, finalDestination, username || undefined, password || undefined);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCloning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 relative">
        <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2"
            onClick={onClose}
            disabled={isCloning}
        >
            <X className="w-4 h-4" />
        </Button>
        
        <h2 className="text-xl font-semibold mb-4">克隆仓库</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">仓库 URL</Label>
            <Input 
              id="url"
              placeholder="https://github.com/username/repo.git"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isCloning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">目标路径 (父目录)</Label>
            <div className="flex gap-2">
                <Input 
                id="destination"
                placeholder="选择保存位置"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={isCloning}
                />
                <Button variant="outline" size="icon" onClick={handleBrowseDestination} disabled={isCloning}>
                    <FolderOpen className="w-4 h-4" />
                </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="username">用户名 (可选)</Label>
                <Input 
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isCloning}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">密码/Token (可选)</Label>
                <Input 
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isCloning}
                />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {isCloning && progress && (
              <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                      <span>接收对象:</span>
                      <span>{progress.received_objects} / {progress.total_objects}</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300" 
                        style={{ width: `${(progress.received_objects / Math.max(progress.total_objects, 1)) * 100}%` }}
                      />
                  </div>
                  <div className="flex justify-between pt-1">
                      <span>已下载:</span>
                      <span>{(progress.received_bytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
              </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleClone} disabled={isCloning} className="w-full">
              {isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  克隆中...
                </>
              ) : (
                '克隆'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
