import { useState, useEffect } from 'react';
import { Search, X, Loader2, Calendar as CalendarIcon, User, FileText } from 'lucide-react';
import { useRepoStore } from '../store/repoStore';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';
import { Calendar } from './ui/Calendar';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { useDebounce } from '../hooks/useDebounce';

interface CommitSearchProps {
  repoPath: string;
}

export function CommitSearch({ repoPath }: CommitSearchProps) {
  const { searchCommits, isSearching, clearSearchResults } = useRepoStore();
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [path, setPath] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  // Debounce the search execution
  const debouncedSearch = useDebounce(async () => {
    if (!query && !author && !path && !dateFrom && !dateTo) {
      clearSearchResults();
      return;
    }

    await searchCommits(repoPath, {
      query: query || undefined,
      author: author || undefined,
      path: path || undefined,
      dateFrom: dateFrom ? Math.floor(dateFrom.getTime() / 1000) : undefined,
      dateTo: dateTo ? Math.floor(dateTo.getTime() / 1000) : undefined,
      limit: 100,
    });
  }, 500);

  // Trigger search when criteria change
  useEffect(() => {
    debouncedSearch();
  }, [query, author, path, dateFrom, dateTo]);

  const hasActiveFilters = author || path || dateFrom || dateTo;

  const clearAll = () => {
    setQuery('');
    setAuthor('');
    setPath('');
    setDateFrom(undefined);
    setDateTo(undefined);
    clearSearchResults();
  };

  return (
    <div className="relative w-full max-w-sm">
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索提交信息、哈希..."
                className="pl-9 pr-8 h-9 text-sm bg-background/50 border-input hover:bg-background focus:bg-background transition-colors w-full"
            />
             {query && (
                <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
      
      <div className="absolute top-0 right-0 h-full flex items-center pr-1">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                        "h-7 w-7 p-0 rounded-full",
                        hasActiveFilters ? "text-primary bg-primary/10" : "text-muted-foreground"
                    )}
                >
                    <FilterIcon className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">高级搜索</h4>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                                清除全部
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <User className="w-3 h-3" /> 作者
                        </label>
                        <Input 
                            value={author} 
                            onChange={(e) => setAuthor(e.target.value)} 
                            placeholder="例如: John Doe"
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <FileText className="w-3 h-3" /> 文件路径
                        </label>
                        <Input 
                            value={path} 
                            onChange={(e) => setPath(e.target.value)} 
                            placeholder="例如: src/main.rs"
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <CalendarIcon className="w-3 h-3" /> 开始日期
                            </label>
                            <CalendarDatePicker date={dateFrom} setDate={setDateFrom} />
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <CalendarIcon className="w-3 h-3" /> 结束日期
                            </label>
                            <CalendarDatePicker date={dateTo} setDate={setDateTo} />
                        </div>
                    </div>
                </div>
            </PopoverContent>
          </Popover>
      </div>

      {isSearching && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
               <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          </div>
      )}
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
    )
}

function CalendarDatePicker({ date, setDate }: { date: Date | undefined, setDate: (date: Date | undefined) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal h-8 text-xs px-2",
                        !date && "text-muted-foreground"
                    )}
                >
                    {date ? format(date, "yyyy-MM-dd") : <span>选择日期</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-lg">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="rounded-md border bg-background"
                />
            </PopoverContent>
        </Popover>
    )
}
