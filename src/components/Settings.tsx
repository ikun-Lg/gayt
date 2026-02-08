import { useSettingsStore } from '../store/settingsStore';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { X, Key, GitBranch, Settings as SettingsIcon, Keyboard } from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShortcutConfigPanel } from './ShortcutConfigPanel';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'general' | 'ai' | 'git' | 'shortcuts';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '通用', icon: <SettingsIcon className="w-4 h-4" /> },
  { id: 'shortcuts', label: '快捷键', icon: <Keyboard className="w-4 h-4" /> },
  { id: 'ai', label: 'AI 设置', icon: <Key className="w-4 h-4" /> },
  { id: 'git', label: 'Git 凭据', icon: <GitBranch className="w-4 h-4" /> },
];

export function Settings({ isOpen, onClose }: SettingsProps) {
  // ... (existing store hooks)
  const {
    workDir,
    aiProvider,
    deepseekApiKey,
    glmApiKey,
    commitLanguage,
    commitFormat,
    customPrompt,
    gitUsername: savedGitUsername,
    gitPassword: savedGitPassword,
    setAiProvider,
    setDeepseekApiKey,
    setGlmApiKey,
    setCommitLanguage,
    setCommitFormat,
    setCustomPrompt,
    setGitUsername: saveGitUsername,
    setGitPassword: saveGitPassword,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  // ... (existing local state)
  const [localUsername, setLocalUsername] = useState(savedGitUsername || '');
  const [localPassword, setLocalPassword] = useState(savedGitPassword || '');
  const [isLoadingUsername, setIsLoadingUsername] = useState(true);

  // ... (existing effects)
  // Load git username from global config only if not already set
  useEffect(() => {
    if (!savedGitUsername) {
      invoke<string | null>('get_git_username', { path: '.' })
        .then(name => {
          if (name) {
            setLocalUsername(name);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingUsername(false));
    } else {
      setLocalUsername(savedGitUsername);
      setIsLoadingUsername(false);
    }
  }, [savedGitUsername]);

  // Update local state when saved values change
  useEffect(() => {
    if (savedGitUsername) setLocalUsername(savedGitUsername);
    if (savedGitPassword) setLocalPassword(savedGitPassword);
  }, [savedGitUsername, savedGitPassword]);

  if (!isOpen) return null;

  const handleSaveGitCredentials = () => {
    saveGitUsername(localUsername || null);
    saveGitPassword(localPassword || null);
  };

  const handleClearGitCredentials = () => {
    saveGitUsername(null);
    saveGitPassword(null);
    setLocalUsername('');
    setLocalPassword('');
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl flex h-[500px] overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-1 rounded-full hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-2">
            <h2 className="text-lg font-semibold px-3 py-2">设置</h2>
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50 text-muted-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* General Settings */}
            {activeTab === 'general' && (
               // ... existing general settings content
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">通用设置</h3>

                {/* 工作目录 */}
                <div className="space-y-2">
                  <Label>工作目录</Label>
                  <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                    {workDir || '未设置'}
                  </div>
                </div>

                {/* Commit 消息语言 */}
                <div className="space-y-2">
                  <Label>Commit 消息语言</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={commitLanguage === 'zh' ? 'default' : 'outline'}
                      onClick={() => setCommitLanguage('zh')}
                      className="flex-1"
                    >
                      中文
                    </Button>
                    <Button
                      type="button"
                      variant={commitLanguage === 'en' ? 'default' : 'outline'}
                      onClick={() => setCommitLanguage('en')}
                      className="flex-1"
                    >
                      English
                    </Button>
                  </div>
                </div>

                {/* Commit 消息格式 */}
                <div className="space-y-2">
                  <Label>Commit 消息格式</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={commitFormat === 'conventional' ? 'default' : 'outline'}
                      onClick={() => setCommitFormat('conventional')}
                      className="flex-1"
                    >
                      约定式提交
                    </Button>
                    <Button
                      type="button"
                      variant={commitFormat === 'custom' ? 'default' : 'outline'}
                      onClick={() => setCommitFormat('custom')}
                      className="flex-1"
                    >
                      自定义
                    </Button>
                  </div>
                </div>

                {/* 自定义提示词 */}
                {commitFormat === 'custom' && (
                  <div className="space-y-2">
                    <Label>自定义提示词</Label>
                    <Input
                      value={customPrompt || ''}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="输入自定义的 AI 提示词..."
                    />
                    <p className="text-xs text-muted-foreground">
                      可用变量: {'{{changes}}'} - 文件变更列表
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Shortcuts Settings */}
            {activeTab === 'shortcuts' && (
              <ShortcutConfigPanel />
            )}

            {/* AI Settings */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">AI 设置</h3>

                {/* AI 提供商 */}
                <div className="space-y-2">
                  <Label>AI 提供商</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={aiProvider === 'heuristic' ? 'default' : 'outline'}
                      onClick={() => setAiProvider('heuristic')}
                      className="w-full"
                    >
                      启发式
                    </Button>
                    <Button
                      type="button"
                      variant={aiProvider === 'deepseek' ? 'default' : 'outline'}
                      onClick={() => setAiProvider('deepseek')}
                      className="w-full"
                    >
                      DeepSeek
                    </Button>
                    <Button
                      type="button"
                      variant={aiProvider === 'glm' ? 'default' : 'outline'}
                      onClick={() => setAiProvider('glm')}
                      className="w-full"
                    >
                      GLM
                    </Button>
                  </div>
                </div>

                {/* DeepSeek API Key */}
                {aiProvider === 'deepseek' && (
                  <div className="space-y-2">
                    <Label>DeepSeek API Key</Label>
                    <Input
                      type="password"
                      value={deepseekApiKey || ''}
                      onChange={(e) => setDeepseekApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-muted-foreground">
                      在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">DeepSeek 平台</a> 获取 API Key
                    </p>
                  </div>
                )}

                {/* GLM API Key */}
                {aiProvider === 'glm' && (
                  <div className="space-y-2">
                    <Label>GLM API Key</Label>
                    <Input
                      type="password"
                      value={glmApiKey || ''}
                      onChange={(e) => setGlmApiKey(e.target.value)}
                      placeholder="输入 GLM API Key"
                    />
                    <p className="text-xs text-muted-foreground">
                      在 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">智谱 AI 平台</a> 获取 API Key
                    </p>
                  </div>
                )}

                {aiProvider === 'heuristic' && (
                  <div className="p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
                    使用启发式规则生成提交信息，不依赖外部 AI 服务。
                  </div>
                )}
              </div>
            )}

            {/* Git Credentials */}
            {activeTab === 'git' && (
               // ... existing git credentials content
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Git 凭据</h3>

                <p className="text-sm text-muted-foreground">
                  配置 Git 凭据用于发布分支和推送提交。用户名将自动从 Git 全局配置获取，如未配置可手动输入。
                </p>

                {/* 用户名和密码都已保存 */}
                {savedGitUsername && savedGitPassword ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/30 rounded-md space-y-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground">用户名:</span> {savedGitUsername}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Token:</span> {'*'.repeat(8)}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleClearGitCredentials}
                    >
                      清除凭据
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 用户名输入 */}
                    <div className="space-y-2">
                      <Label>用户名</Label>
                      <Input
                        value={localUsername}
                        onChange={(e) => setLocalUsername(e.target.value)}
                        placeholder={isLoadingUsername ? '加载中...' : 'Git 用户名'}
                        disabled={isLoadingUsername}
                      />
                      <p className="text-xs text-muted-foreground">
                        用户名将自动从 <code>git config --global user.name</code> 获取，如未获取到可手动输入
                      </p>
                    </div>

                    {/* Token 输入 */}
                    <div className="space-y-2">
                      <Label>Personal Access Token</Label>
                      <Input
                        type="password"
                        value={localPassword}
                        onChange={(e) => setLocalPassword(e.target.value)}
                        placeholder="输入 Personal Access Token"
                      />
                      <p className="text-xs text-muted-foreground">
                        对于 GitHub，请在设置中生成 Personal Access Token（勾选 repo 权限）
                      </p>
                    </div>

                    <Button
                      onClick={handleSaveGitCredentials}
                      disabled={!localUsername || !localPassword}
                      className="w-full"
                    >
                      保存凭据
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
