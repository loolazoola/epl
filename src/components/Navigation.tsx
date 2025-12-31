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
    { href: '/table', label: 'Table', icon: '🏆' },
    { href: '/api-test', label: 'API Test', icon: '🔧' },
  ];

  return (
    <nav className={`flex flex-wrap gap-2 ${className}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}