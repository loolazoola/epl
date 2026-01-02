"use client";

import { usePathname } from 'next/navigation';

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = "" }: NavigationProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/matches', label: 'Fixtures', icon: '📅' },
    { href: '/results', label: 'Results', icon: '⚽' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { href: '/table', label: 'Table', icon: '📊' },
    // API Test route is hidden from navigation but remains accessible via direct URL
  ];

  return (
    <nav className={`flex flex-wrap gap-2 ${className}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible ${
              isActive
                ? 'bg-pl-primary text-pl-white shadow-md'
                : 'bg-card text-card-foreground hover:bg-muted hover:shadow-sm border border-border'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}