import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { FolderOpen, Github } from 'lucide-react';

interface WelcomeDialogProps {
  onWorkDirSelected: (dir: string) => void;
}

export function WelcomeDialog({ onWorkDirSelected }: WelcomeDialogProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleSelectDirectory = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Git 项目目录',
      });

      if (selected && typeof selected === 'string') {
        onWorkDirSelected(selected);
        setIsOpen(false);
      }
    } catch (e) {
      console.error('打开目录失败:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Github className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold">欢迎使用 GAT</h1>
            <p className="text-muted-foreground mt-2">
              多项目 Git 管理工具
            </p>
          </div>

          <div className="text-sm text-muted-foreground text-left space-y-2 bg-muted/50 p-4 rounded-lg">
            <p>• 一目了然地查看所有 Git 仓库</p>
            <p>• AI 智能生成 Commit 消息</p>
            <p>• 批量提交多个项目</p>
          </div>

          <Button onClick={handleSelectDirectory} className="w-full" size="lg">
            <FolderOpen className="w-5 h-5 mr-2" />
            选择项目目录
          </Button>

          <p className="text-xs text-muted-foreground">
            选择包含您的 Git 项目的文件夹
          </p>
        </div>
      </Card>
    </div>
  );
}
