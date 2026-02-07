
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Tag } from 'lucide-react';

interface CreateTagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, message?: string, target?: string) => Promise<void>;
  currentHead: string;
}

export function CreateTagDialog({ isOpen, onClose, onCreate, currentHead }: CreateTagDialogProps) {
  const [tagName, setTagName] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTagName('');
      setMessage('');
      setTarget('');
      setError(null);
      // Focus input after a short delay to allow rendering
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!tagName.trim()) {
      setError('请输入标签名称');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(tagName.trim(), message.trim() || undefined, target.trim() || undefined);
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
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">新建标签</h2>
          </div>
          
          <p className="text-sm text-muted-foreground">
            在当前提交 <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{currentHead.substring(0, 7)}</span> 上创建新标签
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground ml-1">标签名称 *</label>
                <Input
                  ref={inputRef}
                  value={tagName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setTagName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="v1.0.0"
                  className="h-9 bg-background/50"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-1">
                 <label className="text-xs font-medium text-muted-foreground ml-1">说明 (可选)</label>
                 <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="例如：发布 v1.0.0 版本"
                    className="h-20 bg-background/50 resize-none"
                    disabled={isCreating}
                 />
                 <p className="text-[10px] text-muted-foreground ml-1">
                    填写说明将创建附注标签 (Annotated Tag)
                 </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground ml-1">目标提交 (可选)</label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="默认当前 HEAD"
                  className="h-9 bg-background/50 font-mono text-xs"
                  disabled={isCreating}
                />
              </div>
              
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
                disabled={!tagName.trim() || isCreating}
              >
                {isCreating ? '创建中...' : '创建标签'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
