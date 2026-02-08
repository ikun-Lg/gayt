import { X, FileText, Check, Plus, Minus, Columns, AlignJustify } from 'lucide-react';
import { Button } from './ui/Button';
import { FileDiff } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { useRepoStore } from '../store/repoStore';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useThemeStore } from '../store/themeStore';

// Language support
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);

interface DiffViewProps {
  repoPath: string;
  filename: string;
  diff: FileDiff | null;
  onClose: () => void;
}

type ViewMode = 'unified' | 'split';

export function DiffView({ repoPath, filename, diff, onClose }: DiffViewProps) {
  const { stageChunk, selectedRepoPath } = useRepoStore();
  const { mode } = useThemeStore();
  const effectiveRepoPath = repoPath || selectedRepoPath || '';

  const [selectedIndices, setSelectedIndices] = useState<Set<string>>(new Set());
  const [isStaging, setIsStaging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  // Detect language
  const language = useMemo(() => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': return 'typescript';
        case 'js': case 'jsx': return 'javascript';
        case 'rs': return 'rust';
        case 'json': return 'json';
        case 'css': return 'css';
        case 'md': return 'markdown';
        case 'py': return 'python';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'c': case 'h': return 'c';
        case 'cpp': case 'hpp': return 'cpp';
        default: return 'text';
    }
  }, [filename]);

  // Determine syntax style
  // We need to check if 'dark' class is present on html or based on system preference if mode is 'system'
  // But useThemeStore gives us 'light' | 'dark' | 'system'.
  // We can use a simpler heuristic or just default to vscDarkPlus for dark mode.
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const syntaxStyle = isDark ? vscDarkPlus : materialLight;

  // Reset selection when diff changes
  useEffect(() => {
    setSelectedIndices(new Set());
  }, [diff]);

  if (!diff) return null;

  const toggleLine = (hunkIndex: number, lineIndex: number) => {
    const key = `${hunkIndex}-${lineIndex}`;
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedIndices(newSelected);
  };

  const toggleHunk = (hunkIndex: number, shouldSelect: boolean) => {
    const newSet = new Set(selectedIndices);
    diff.hunks[hunkIndex].lines.forEach((line, lineIndex) => {
      // Only select/deselect change lines, ignore context
      if (line.origin === '+' || line.origin === '-') {
        const key = `${hunkIndex}-${lineIndex}`;
        if (shouldSelect) {
          newSet.add(key);
        } else {
          newSet.delete(key);
        }
      }
    });
    setSelectedIndices(newSet);
  };

  const handleStageSelected = async () => {
    if (selectedIndices.size === 0) return;
    setIsStaging(true);
    try {
      const patch = generatePatch(diff, selectedIndices);
      if (!effectiveRepoPath) {
        console.error('DiffView: repoPath is missing!');
        return;
      }
      await stageChunk(effectiveRepoPath, patch);
    } catch (e) {
      console.error('Failed to stage chunk:', e);
    } finally {
      setIsStaging(false);
    }
  };

  const renderContent = (content: string) => {
    return (
        <SyntaxHighlighter
            language={language}
            style={syntaxStyle}
            customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: 'inherit' }}
            wrapLongLines={true}
            PreTag="span" 
        >
            {content}
        </SyntaxHighlighter>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-md border-l border-border/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate text-foreground/80">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex bg-muted/20 rounded-lg p-0.5 border border-border/20">
                <button
                    onClick={() => setViewMode('unified')}
                    className={cn(
                        "p-1.5 rounded-md transition-all",
                        viewMode === 'unified' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Unified View"
                >
                    <AlignJustify className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                        "p-1.5 rounded-md transition-all",
                        viewMode === 'split' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Split View"
                >
                    <Columns className="w-4 h-4" />
                </button>
            </div>

           <Button
            size="sm"
            variant="default"
            disabled={selectedIndices.size === 0 || isStaging}
            onClick={handleStageSelected}
            className="h-7 text-xs"
          >
            {isStaging ? '暂存中...' : `暂存选中 (${selectedIndices.size})`}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 font-mono text-xs no-scrollbar">
        <div className="space-y-4">
          {diff.hunks.map((hunk, hunkIndex) => (
            <div key={hunkIndex} className="border border-border/40 rounded-md overflow-hidden bg-background/30">
              <div className="bg-muted/40 px-3 py-1.5 border-b border-border/40 flex items-center justify-between group">
                <span className="text-muted-foreground opacity-70">{hunk.header}</span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button 
                     onClick={() => toggleHunk(hunkIndex, true)}
                     className="text-[10px] hover:text-primary transition-colors"
                   >
                     全选
                   </button>
                   <button 
                     onClick={() => toggleHunk(hunkIndex, false)}
                     className="text-[10px] hover:text-primary transition-colors"
                   >
                     取消
                   </button>
                </div>
              </div>
              
              {viewMode === 'unified' ? (
                  // Unified View
                  <div className="divide-y divide-border/20">
                    {hunk.lines.map((line, lineIndex) => {
                      const isChange = line.origin === '+' || line.origin === '-';
                      const isSelected = selectedIndices.has(`${hunkIndex}-${lineIndex}`);
                      
                      let bgClass = "";
                      let textClass = "";
                      
                      if (line.origin === '+') {
                        bgClass = isSelected ? "bg-green-500/20" : "bg-green-500/5 hover:bg-green-500/10";
                        textClass = "text-green-600 dark:text-green-400";
                      } else if (line.origin === '-') {
                        bgClass = isSelected ? "bg-red-500/20" : "bg-red-500/5 hover:bg-red-500/10";
                        textClass = "text-red-600 dark:text-red-400";
                      } else {
                        textClass = "text-muted-foreground/60";
                      }

                      return (
                        <div 
                          key={lineIndex} 
                          className={cn(
                            "flex group cursor-pointer transition-colors",
                            bgClass
                          )}
                          onClick={() => isChange && toggleLine(hunkIndex, lineIndex)}
                        >
                          <div className="w-10 flex items-center justify-center border-r border-border/20 shrink-0 select-none bg-muted/10">
                             {isChange && (
                               <div className={cn(
                                 "w-3.5 h-3.5 border rounded flex items-center justify-center transition-all",
                                 isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                               )}>
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                               </div>
                             )}
                          </div>
                          <div className="w-8 text-right pr-2 select-none opacity-40 border-r border-border/20 shrink-0 text-[10px] py-0.5">
                            {line.oldLineno}
                          </div>
                          <div className="w-8 text-right pr-2 select-none opacity-40 border-r border-border/20 shrink-0 text-[10px] py-0.5">
                            {line.newLineno}
                          </div>
                          <div className="w-4 flex items-center justify-center select-none opacity-60 shrink-0">
                            {line.origin === '+' && <Plus className="w-3 h-3" />}
                            {line.origin === '-' && <Minus className="w-3 h-3" />}
                          </div>
                          <div className={cn("px-2 py-0.5 whitespace-pre-wrap break-all flex-1", textClass)}>
                            {renderContent(line.content)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
              ) : (
                  // Split View
                   <div className="flex divide-x divide-border/20">
                    <SplitViewRows 
                        hunk={hunk} 
                        hunkIndex={hunkIndex} 
                        selectedIndices={selectedIndices} 
                        toggleLine={toggleLine} 
                        renderContent={renderContent}
                        onToggleLine={toggleLine}
                    />
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper component for Split View to handle the complex alignment logic
function SplitViewRows({ hunk, hunkIndex, selectedIndices, renderContent, onToggleLine }: any) {
    // Process lines to create aligned rows
    const rows: { left?: any, right?: any, leftIndex?: number, rightIndex?: number }[] = [];
    
    let i = 0;
    while (i < hunk.lines.length) {
        const line = hunk.lines[i];
        
        if (line.origin === ' ') {
            rows.push({ left: line, right: line, leftIndex: i, rightIndex: i });
            i++;
        } else if (line.origin === '-') {
            // Check if followed by +
            let j = i + 1;
            // Collect all consecutive -
            const deletions = [line];
            const delIndices = [i];
            
            while (j < hunk.lines.length && hunk.lines[j].origin === '-') {
                deletions.push(hunk.lines[j]);
                delIndices.push(j);
                j++;
            }
            
            // Collect all consecutive + immediately following
            const additions: any[] = [];
            const addIndices: any[] = [];
            while (j < hunk.lines.length && hunk.lines[j].origin === '+') {
                additions.push(hunk.lines[j]);
                addIndices.push(j);
                j++;
            }
            
            // Now assume they map 1-to-1 as modification, remainder is pure add/del
            const maxLen = Math.max(deletions.length, additions.length);
            for (let k = 0; k < maxLen; k++) {
                rows.push({
                    left: k < deletions.length ? deletions[k] : null,
                    right: k < additions.length ? additions[k] : null,
                    leftIndex: k < deletions.length ? delIndices[k] : undefined,
                    rightIndex: k < additions.length ? addIndices[k] : undefined
                });
            }
             i = j;
        } else if (line.origin === '+') {
            // Pure addition (not preceded by - because we handled that above)
             rows.push({ left: null, right: line, rightIndex: i });
             i++;
        }
    }

    return (
        <div className="flex flex-col w-full">
            {rows.map((row, idx) => {
                 const isLeftSelected = row.leftIndex !== undefined && selectedIndices.has(`${hunkIndex}-${row.leftIndex}`);
                 const isRightSelected = row.rightIndex !== undefined && selectedIndices.has(`${hunkIndex}-${row.rightIndex}`);
                 
                 const leftClass = row.left?.origin === '-' 
                    ? (isLeftSelected ? "bg-red-500/20" : "bg-red-500/5 hover:bg-red-500/10")
                    : "";
                 const rightClass = row.right?.origin === '+'
                    ? (isRightSelected ? "bg-green-500/20" : "bg-green-500/5 hover:bg-green-500/10")
                    : "";

                 return (
                    <div key={idx} className="flex divide-x divide-border/20 group/row min-h-[1.5em]">
                        {/* Left Column */}
                        <div 
                            className={cn("w-1/2 flex cursor-pointer transition-colors overflow-hidden", leftClass)}
                            onClick={() => row.leftIndex !== undefined && row.left?.origin === '-' && onToggleLine(hunkIndex, row.leftIndex)}
                        >
                            {row.left ? (
                                <>
                                    <div className="w-8 text-right pr-2 select-none opacity-40 border-r border-border/20 shrink-0 text-[10px] py-0.5 bg-muted/5">
                                        {row.left.oldLineno}
                                    </div>
                                    <div className="w-4 flex items-center justify-center select-none opacity-60 shrink-0">
                                        {row.left.origin === '-' && <Minus className="w-3 h-3" />}
                                        {isLeftSelected && <Check className="w-2.5 h-2.5 text-primary" />}
                                    </div>
                                    <div className={cn("px-2 py-0.5 whitespace-pre-wrap break-all flex-1")}>
                                        {renderContent(row.left.content)}
                                    </div>
                                </>
                            ) : (
                                <div className="w-full bg-muted/5 opacity-50 select-none"></div>
                            )}
                        </div>

                        {/* Right Column */}
                        <div 
                            className={cn("w-1/2 flex cursor-pointer transition-colors overflow-hidden", rightClass)}
                            onClick={() => row.rightIndex !== undefined && row.right?.origin === '+' && onToggleLine(hunkIndex, row.rightIndex)}
                        >
                             {row.right ? (
                                <>
                                    <div className="w-8 text-right pr-2 select-none opacity-40 border-r border-border/20 shrink-0 text-[10px] py-0.5 bg-muted/5">
                                        {row.right.newLineno}
                                    </div>
                                    <div className="w-4 flex items-center justify-center select-none opacity-60 shrink-0">
                                        {row.right.origin === '+' && <Plus className="w-3 h-3" />}
                                        {isRightSelected && <Check className="w-2.5 h-2.5 text-primary" />}
                                    </div>
                                    <div className={cn("px-2 py-0.5 whitespace-pre-wrap break-all flex-1")}>
                                        {renderContent(row.right.content)}
                                    </div>
                                </>
                             ) : (
                                <div className="w-full bg-muted/5 opacity-50 select-none"></div>
                             )}
                        </div>
                    </div>
                 );
            })}
        </div>
    );
}

function generatePatch(fileDiff: FileDiff, selectedIndices: Set<string>): string {
  // Check if it's a new file based on first hunk
  const isNewFile = fileDiff.hunks.length > 0 && fileDiff.hunks[0].header.startsWith('@@ -0,0');
  
  let patch = '';
  if (isNewFile) {
    patch = `--- /dev/null\n+++ b/${fileDiff.path}\n`;
  } else {
    patch = `--- a/${fileDiff.path}\n+++ b/${fileDiff.path}\n`;
  }
  
  for (let h = 0; h < fileDiff.hunks.length; h++) {
    const hunk = fileDiff.hunks[h];
    const newHunkLines: string[] = [];
    
    // Parse header to get start lines
    const headerMatch = hunk.header.match(/@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!headerMatch) continue;
    
    const oldStartLine = parseInt(headerMatch[1]);
    const newStartLine = parseInt(headerMatch[3]); 
    
    let oldLen = 0;
    let newLen = 0;
    
    let hasSelectionInHunk = false;

    for (let l = 0; l < hunk.lines.length; l++) {
      const line = hunk.lines[l];
      const isSelected = selectedIndices.has(`${h}-${l}`);
      
      // Logic for Staging (Working Dir -> Index)
      
      // Context (' '): Always keep
      if (line.origin === ' ') {
        newHunkLines.push(' ' + line.content);
        oldLen++;
        newLen++;
      }
      // Addition ('+'):
      else if (line.origin === '+') {
         if (isSelected) {
           newHunkLines.push('+' + line.content);
           newLen++;
           hasSelectionInHunk = true;
         } else {
           // Omit. Not in index, not staging.
         }
      }
      // Deletion ('-'):
      else if (line.origin === '-') {
        if (isSelected) {
          newHunkLines.push('-' + line.content);
          oldLen++;
          hasSelectionInHunk = true;
        } else {
          // Keep it (unstaged deletion -> context)
          newHunkLines.push(' ' + line.content);
          oldLen++;
          newLen++; 
        }
      }
    }
    
    if (hasSelectionInHunk) {
      // Reconstruct header
      let header = `@@ -${oldStartLine}`;
      if (oldLen !== 1) header += `,${oldLen}`;
      header += ` +${newStartLine}`;
      
      if (newLen !== 1) header += `,${newLen}`;
      header += ` @@`;
      
      patch += header + '\n';
      patch += newHunkLines.join('\n') + '\n';
    }
  }
  
  return patch;
}
