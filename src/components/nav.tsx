'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/brons', label: 'Agents' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">B</span>
            </div>
            <div className="absolute inset-0 rounded-lg bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="heading-serif text-2xl text-gradient-warm">Bron</span>
        </Link>

        {/* Center Nav */}
        <nav className="flex items-center">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right side - Gmail status */}
        <GmailStatus />
      </div>
    </header>
  );
}

interface GmailStatusData {
  connected: boolean;
  email?: string;
}

function GmailStatus() {
  const [status, setStatus] = useState<GmailStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/gmail/status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch {
        // Silently fail - show as disconnected
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const isConnected = status?.connected ?? false;

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium border border-border/50 bg-muted/30">
        <span className="status-dot idle h-2 w-2" />
        <span className="text-muted-foreground">...</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium',
          'border border-[oklch(0.70_0.18_145)] bg-[oklch(0.70_0.18_145/0.1)] text-[oklch(0.80_0.15_145)]'
        )}
      >
        <span className="status-dot success h-2 w-2" />
        <span className="truncate max-w-[150px]" title={status?.email}>
          {status?.email || 'Gmail Connected'}
        </span>
      </div>
    );
  }

  return (
    <Link
      href="/api/gmail/connect"
      className={cn(
        'flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
        'border border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
    >
      <span className="status-dot idle h-2 w-2" />
      Connect Gmail
    </Link>
  );
}
