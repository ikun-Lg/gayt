import { useEffect, useState } from 'react';
import { useRepoStore } from './store/repoStore';
import { useSettingsStore } from './store/settingsStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { UnlistenFn } from '@tauri-apps/api/event';
import { RepoList } from './components/RepoList';
import { RepoView } from './components/RepoView';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ScanDialog } from './components/ScanDialog';
import { Settings } from './components/Settings';
import { Button } from './components/ui/Button';
import { Settings as SettingsIcon, Github } from 'lucide-react';
import './App.css';

function App() {
  const { repositories, selectedRepoPath, scanRepositories, isLoading } = useRepoStore();
  const { workDir, setWorkDir } = useSettingsStore();
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (workDir) {
      scanRepositories(workDir);
    }
  }, [workDir, scanRepositories]);

  // 自动刷新逻辑
  useEffect(() => {
    const { refreshStatus, refreshBranchInfo, refreshAllRepoStatus } = useRepoStore.getState();

    // 1. 窗口聚焦时刷新
    const unlistenPromise = getCurrentWindow().listen('tauri://focus', () => {
      const currentSelected = useRepoStore.getState().selectedRepoPath;
      if (currentSelected) {
        refreshStatus(currentSelected);
        refreshBranchInfo(currentSelected);
      }
      refreshAllRepoStatus();
    });

    // 2. 定时轮询
    // 每 10 秒刷新当前选中的仓库状态
    const statusInterval = setInterval(() => {
      const currentSelected = useRepoStore.getState().selectedRepoPath;
      if (currentSelected) {
        useRepoStore.getState().refreshStatus(currentSelected);
      }
    }, 10000);

    // 每 30 秒刷新所有仓库状态（更新左侧列表的变更图标）
    const allReposInterval = setInterval(() => {
      useRepoStore.getState().refreshAllRepoStatus();
    }, 30000);

    return () => {
      unlistenPromise.then((unlisten: UnlistenFn) => unlisten());
      clearInterval(statusInterval);
      clearInterval(allReposInterval);
    };
  }, []); // 仅在组件挂载时运行一次监听器设置

  const handleWorkDirSelected = (dir: string) => {
    setWorkDir(dir);
  };

  const handleScan = async (path: string) => {
    await scanRepositories(path);
    setWorkDir(path);
  };

  const showWelcome = !workDir;

  return (
    <div className="h-screen flex flex-col bg-background selection:bg-primary/20">
      {/* 头部 */}
      <header className="h-14 flex items-center justify-between px-6 sticky top-0 z-50 bg-glass drop-shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Github className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-bold tracking-tight text-lg">gayt</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(true)}
            className="hover:bg-primary/10 hover:text-primary transition-colors duration-200"
            title="设置"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-80 sidebar-glass flex flex-col shadow-inner">
          <RepoList onScanClick={() => setShowScanDialog(true)} />
        </aside>

        {/* 主视图 */}
        <main className="flex-1 bg-background/50 relative">
          {selectedRepoPath ? (
            <RepoView repoPath={selectedRepoPath} />
          ) : repositories.length > 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p>选择一个仓库查看详情</p>
            </div>
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p>正在扫描仓库...</p>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p>未找到仓库。点击文件夹图标扫描目录。</p>
            </div>
          )}
        </main>
      </div>

      {/* 对话框 */}
      {showWelcome && <WelcomeDialog onWorkDirSelected={handleWorkDirSelected} />}
      <ScanDialog
        isOpen={showScanDialog}
        onClose={() => setShowScanDialog(false)}
        onScan={handleScan}
      />
      {showSettings && (
        <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default App;
