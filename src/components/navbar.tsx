'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, ListChecks, Moon, ScrollText, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiSettingsDialog } from '@/components/settings/ai-settings-dialog';
import { cn } from '@/lib/utils';

interface NavbarProps {
  chapterEntry?: ReactNode;
  rightEntry?: ReactNode;
  isMobile?: boolean;
}

export function Navbar({ chapterEntry, rightEntry, isMobile = false }: NavbarProps) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className={cn('flex items-center gap-1 sm:gap-3', isMobile ? 'h-12 px-2' : 'h-14 px-4')}>
        <Link href="/" className={cn('flex items-center gap-2 group shrink-0', isMobile ? 'mr-1' : 'mr-4')}>
          <div className={cn('flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow', isMobile ? 'h-7 w-7' : 'h-8 w-8')}>
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className={cn('font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent whitespace-nowrap', isMobile ? 'text-base hidden sm:inline' : 'text-lg')}>
            AI-Recall
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-hide">
          {chapterEntry}
          <Link href="/">
            <Button variant="ghost" size="sm" className={cn('text-muted-foreground hover:text-foreground gap-2 shrink-0', isMobile ? 'px-2 h-8' : 'px-3')}>
              <BookOpen className="h-4 w-4" />
              <span className={cn(isMobile && 'hidden sm:inline')}>学习</span>
            </Button>
          </Link>
          <Link href="/errors">
            <Button variant="ghost" size="sm" className={cn('text-muted-foreground hover:text-foreground gap-2 shrink-0', isMobile ? 'px-2 h-8' : 'px-3')}>
              <ListChecks className="h-4 w-4" />
              <span className={cn(isMobile && 'hidden sm:inline')}>错题本</span>
            </Button>
          </Link>
          <Link href="/favorites">
            <Button variant="ghost" size="sm" className={cn('text-muted-foreground hover:text-foreground gap-2 shrink-0', isMobile ? 'px-2 h-8' : 'px-3')}>
              <Star className="h-4 w-4" />
              <span className={cn(isMobile && 'hidden sm:inline')}>收藏</span>
            </Button>
          </Link>
          <Link href="/ai-logs">
            <Button variant="ghost" size="sm" className={cn('text-muted-foreground hover:text-foreground gap-2 shrink-0', isMobile ? 'px-2 h-8' : 'px-3')}>
              <ScrollText className="h-4 w-4" />
              <span className={cn(isMobile && 'hidden sm:inline')}>AI日志</span>
            </Button>
          </Link>
        </nav>

        <div className={cn('ml-auto flex items-center', isMobile ? 'gap-1' : 'gap-2')}>
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-muted-foreground hover:text-foreground', isMobile ? 'h-7 w-7' : 'h-8 w-8')}
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <AiSettingsDialog />
          {rightEntry}
        </div>
      </div>
    </header>
  );
}
