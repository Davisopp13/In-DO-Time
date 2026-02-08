'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/time-log', label: 'Time Log' },
  { href: '/reports', label: 'Reports' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-6 z-50 mx-auto max-w-7xl px-4 mb-8 flex items-center justify-between">
        {/* Logo - Independent Floating Element */}
        <Link href="/" className="relative flex items-center h-auto w-auto shrink-0 transition-transform hover:scale-105 duration-200">
          <div className="relative h-24 md:h-40 w-auto aspect-[3/2]">
            <Image
              src="/In_DO_Time_Logo.png"
              alt="In DO Time Logo"
              width={400}
              height={264}
              className="h-full w-auto object-contain brightness-110 drop-shadow-lg"
              priority
            />
          </div>
        </Link>

        {/* Navigation Pill "Island" */}
        <div className="glass-nav rounded-full px-3 py-2 flex items-center gap-1">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${isActive
                    ? 'bg-surface/50 text-text dark:text-white border border-white/10 shadow-sm'
                    : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-surface/30'
                    }`}
                >
                  {item.label}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-accent/10 dark:bg-accent/5 pointer-events-none" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mx-1 h-6 w-px bg-border hidden md:block" />
          <ThemeToggle />

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-full p-2.5 text-text-muted hover:bg-surface/30 hover:text-text dark:hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Overlay */}
        <div className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} />

        {/* Mobile Navigation Dropdown */}
        <div className={`absolute top-full right-0 mt-2 w-full max-w-sm transform transition-all duration-300 origin-top-right md:hidden ${mobileMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
          <nav className="glass-panel mx-4 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl bg-surface/95 backdrop-blur-xl border border-white/20 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 ${isActive
                    ? 'bg-accent/10 text-text dark:text-white border border-accent/20 shadow-sm'
                    : 'text-text-muted hover:bg-surface/50 hover:text-text dark:hover:text-white'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    {item.label}
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </>
  );
}
