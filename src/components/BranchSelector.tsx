import { useRepoStore } from '../store/repoStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { GitBranch, Cloud, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';

interface BranchSelectorProps {
  repoPath: string;
}

interface AuthDialogProps {
  repoPath: string;
  onSubmit: (username: string, password: string) => void;
  onCancel: () => void;
}

const STORE_PATH = 'git_credentials.json';

// Save credential to store
async function saveCredential(repoPath: string, username: string, password: string): Promise<void> {
  const store = await Store.load(STORE_PATH);
  const key = `credential_${repoPath}`;
  await store.set(key, { username, password });
  await store.save();
}

// Load credential from store
async function loadCredential(repoPath: string): Promise<{ username: string; password: string } | null> {
  const store = await Store.load(STORE_PATH);
  const key = `credential_${repoPath}`;
  const cred = await store.get<{ username: string; password: string }>(key);
  return cred || null;
}

function AuthDialog({ repoPath, onSubmit, onCancel }: AuthDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Load saved credential and default username
  useEffect(() => {
    Promise.all([
      loadCredential(repoPath),
      invoke<string | null>('get_git_username', { path: repoPath })
    ])
      .then(([savedCred, gitUsername]) => {
        if (savedCred) {
          setUsername(savedCred.username);
          setPassword(savedCred.password);
        } else if (gitUsername) {
          setUsername(gitUsername);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [repoPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save credential before submitting
    saveCredential(repoPath, username, password).catch(console.error);
    onSubmit(username, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-80 p-4">
        <h3 className="text-lg font-semibold mb-4">身份验证</h3>
        <p className="text-sm text-muted-foreground mb-4">
          请输入您的 Git 凭据以发布分支
        </p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="git"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">密码 / Token</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md pr-8"
                  placeholder="Personal Access Token"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              凭据将加密保存在本地，下次使用时自动填充
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!username || !password || isLoading}
            >
              确认
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function BranchSelector({ repoPath }: BranchSelectorProps) {
  const { currentBranchInfo, localBranches, switchBranch, publishBranch, loadLocalBranches, refreshBranchInfo } = useRepoStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handlePublish = () => {
    // 直接显示身份验证对话框
    setErrorMessage(null);
    setShowAuthDialog(true);
  };

  const handlePublishWithAuth = async (username: string, password: string) => {
    setShowAuthDialog(false);
    setIsPublishing(true);
    setErrorMessage(null);
    try {
      await publishBranch(repoPath, currentBranch, 'origin', username, password);
      // 刷新分支信息
      await refreshBranchInfo(repoPath);
      // 发布成功，关闭下拉菜单
      setIsOpen(false);
    } catch (e) {
      console.error('发布分支失败:', e);
      setErrorMessage(String(e));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpen = () => {
    loadLocalBranches(repoPath);
    setIsOpen(true);
    setErrorMessage(null);
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

      {showAuthDialog && (
        <AuthDialog
          repoPath={repoPath}
          onSubmit={handlePublishWithAuth}
          onCancel={() => setShowAuthDialog(false)}
        />
      )}

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
                {errorMessage && (
                  <p className="text-xs text-red-500 mt-2">{errorMessage}</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
