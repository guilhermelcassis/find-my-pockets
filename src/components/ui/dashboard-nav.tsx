'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  title: string;
  href: string;
  icon: string;
}

export function DashboardNav() {
  const pathname = usePathname();
  
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: '📊',
    },
    {
      title: 'Home',
      href: '/',
      icon: '🏠',
    },
    {
      title: 'Admin',
      href: '/admin',
      icon: '⚙️',
    },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm mb-8">
      <div className="flex items-center space-x-2">
        <img 
          src="/FMP_Roxo.svg" 
          alt="Find My Pockets" 
          className="h-8 w-auto"
        />
        <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded-md">Dashboard</span>
      </div>
      
      <div className="flex space-x-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
} 