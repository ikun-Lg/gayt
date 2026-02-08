
import { useState } from 'react';
import { useSettingsStore, ShortcutDef } from '../store/settingsStore';
import { defaultShortcuts } from '../lib/shortcuts';
import { Button } from './ui/Button';
import { RotateCcw, Keyboard as KeyboardIcon, Command } from 'lucide-react';
import { cn } from '../lib/utils';

export function ShortcutConfigPanel() {
  const { shortcuts, setShortcut, resetShortcuts } = useSettingsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only key presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }

    const newDef: ShortcutDef = {
      key: e.key,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    };

    setShortcut(id, newDef);
    setRecordingId(null);
  };

  const formatKey = (def: ShortcutDef) => {
    const parts: string[] = [];
    if (def.ctrlKey) parts.push('Ctrl');
    if (def.altKey) parts.push('Alt');
    if (def.shiftKey) parts.push('Shift');
    if (def.metaKey) parts.push('Cmd');
    
    let key = def.key.toUpperCase();
    if (key === ' ') key = 'Space';
    parts.push(key);
    
    return parts.join(' + ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <KeyboardIcon className="w-5 h-5" />
          快捷键设置
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={resetShortcuts}
          className="h-8 gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          恢复默认
        </Button>
      </div>

      <div className="space-y-1 rounded-lg border border-border/50 bg-card overflow-hidden">
        {Object.entries(defaultShortcuts).map(([id, config]) => {
          const currentDef = shortcuts[id] || config;
          const isRecording = recordingId === id;

          return (
            <div
              key={id}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{config.description}</span>
                <span className="text-xs text-muted-foreground font-mono opacity-70">
                  {id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isRecording ? (
                  <div 
                    className="flex items-center justify-center min-w-[120px] h-9 rounded-md bg-primary/10 border border-primary text-primary text-xs font-medium animate-pulse cursor-pointer px-3"
                    onClick={() => setRecordingId(null)}
                  >
                    按键盘设置...
                  </div>
                ) : (
                  <button
                    onClick={() => setRecordingId(id)}
                    className={cn(
                      "flex items-center justify-center min-w-[100px] h-9 rounded-md bg-muted border border-border text-xs font-mono transition-all hover:bg-muted/80 hover:border-primary/50 relative group",
                      currentDef !== config && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <span className="group-hover:opacity-20 transition-opacity">
                      {formatKey(currentDef)}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 font-medium text-primary transition-opacity">
                      点击修改
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {recordingId && (
        <div 
          className="fixed inset-0 z-50 bg-background/50 backdrop-blur-[1px] cursor-pointer"
          onClick={() => setRecordingId(null)}
          onKeyDown={(e) => handleKeyDown(e, recordingId)}
          tabIndex={0}
          autoFocus
          style={{ outline: 'none' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover text-popover-foreground p-8 rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200 flex flex-col items-center gap-4">
             <div className="p-4 rounded-full bg-primary/10 text-primary mb-2">
                <Command className="w-8 h-8 animate-pulse" />
             </div>
             <div className="text-center space-y-1">
               <h3 className="text-lg font-semibold">请输入新的快捷键</h3>
               <p className="text-muted-foreground text-sm">按下组合键以设置 "{defaultShortcuts[recordingId as keyof typeof defaultShortcuts].description}"</p>
             </div>
             <div className="mt-4 flex gap-2">
               <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setRecordingId(null); }}>
                 取消
               </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
