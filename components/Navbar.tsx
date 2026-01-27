'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { href: '/', label: t('nav.home'), icon: '🏠' },
    { href: '/expert', label: t('nav.expertScoring'), icon: '⭐' },
    { href: '/arena', label: t('nav.arena'), icon: '🏟️' },
    { href: '/arena/history', label: t('nav.history'), icon: '📚' },
    { href: '/admin/tasks', label: t('nav.batchTasks'), icon: '⚙️' },
    { href: '/admin/arena-batch', label: t('nav.batchArena'), icon: '🎯' },
    { href: '/settings/questions', label: t('nav.questionMgmt'), icon: '❓' },
    { href: '/settings/models', label: t('nav.modelMgmt'), icon: '🤖' },
    { href: '/settings/dimensions', label: t('nav.dimensionMgmt'), icon: '📊' },
  ];

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:scale-110 transition-transform">
              AI
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Benchmark
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <LanguageSwitcher />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 animate-fade-in">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg font-medium transition-all duration-200 mb-1 ${
                  pathname === item.href
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <div className="px-4 pt-2 border-t border-gray-200 mt-2">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
