'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Show, useAuth, useUser, SignInButton, SignUpButton, UserButton } from '@/lib/clerk';
import { dark } from '@clerk/themes';
import { BinocularsIcon, Search, Layers, PlusCircle, LayoutDashboard, ShieldCheck } from 'lucide-react';

// Terminal-style Clerk UserButton appearance (popover renders in shadow DOM,
// so real font names + hex colors are required instead of CSS variables).
const clerkUserButtonAppearance = {
  theme: dark,
  variables: {
    colorPrimary: '#f59e0b',
    colorBackground: '#0f172a',
    colorText: '#e2e8f0',
    colorTextSecondary: '#94a3b8',
    colorDanger: '#ef4444',
    colorSuccess: '#14b8a6',
    fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: '0px',
    borderRadius__avatarBox: '0px',
    borderRadius__userButtonPopoverCard: '0px',
    borderRadius__userButtonPopoverActionButton: '0px',
    borderRadius__userButtonPopoverSessionButton: '0px',
  },
  elements: {
    avatarBox: {
      width: '34px',
      height: '34px',
      border: '1px solid rgba(245, 158, 11, 0.45)',
      backgroundColor: '#020617',
      boxShadow: '0 0 12px rgba(245, 158, 11, 0.15)',
    },
    avatarImage: {
      borderRadius: '0px',
    },
    userButtonPopoverCard: {
      backgroundColor: '#020617',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: '0px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.08)',
    },
    userButtonPopoverMain: {
      backgroundColor: '#020617',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    },
    userButtonPopoverSessionButton: {
      backgroundColor: '#020617',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      },
    },
    userButtonPopoverSessionButtonTextPrimary: {
      color: '#e2e8f0',
    },
    userButtonPopoverSessionButtonTextSecondary: {
      color: '#94a3b8',
    },
    userButtonPopoverFooter: {
      backgroundColor: '#0f172a',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '0px',
    },
    userButtonPopoverDivider: {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    userButtonPopoverActionButton: {
      borderRadius: '0px',
      color: '#e2e8f0',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: '#f8fafc',
      },
    },
    userButtonPopoverActionButtonText: {
      fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '11px',
      letterSpacing: '0.1em',
      color: '#e2e8f0',
    },
    userButtonPopoverActionButtonIcon: {
      color: '#f59e0b',
    },
    userButtonPopoverSignOutButton: {
      color: '#ef4444',
      '&:hover': {
        color: '#f87171',
      },
    },
    userButtonPopoverSignOutButtonIcon: {
      color: '#ef4444',
    },
  },
};

export default function Header() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const role = (user?.publicMetadata?.role as string) || 'user';
  const isAdmin = role === 'admin';

  const isActive = (path: string) => {
    if (path === '/' && pathname !== '/') return false;
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md overflow-x-hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo Layer */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BinocularsIcon className="h-6 w-6 text-brand-amber group-hover:rotate-45 transition-transform duration-300" />
            <span className="font-mono text-lg font-bold tracking-wider bg-gradient-to-r from-brand-amber via-brand-coral to-brand-teal bg-clip-text text-transparent">
              NeedBoard
            </span>
          </Link>
        </div>

        {/* Navigation Layer (Monospace / Utility) */}
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest text-slate-400 uppercase">
          <Link
            href="/"
            className={`transition-colors duration-200 hover:text-slate-100 ${
              isActive('/') ? 'text-slate-100 border-b border-brand-amber pb-1' : ''
            }`}
          >
            Home
          </Link>
          <Link
            href="/submit"
            className={`transition-colors duration-200 hover:text-slate-100 ${
              isActive('/submit') ? 'text-slate-100 border-b border-brand-amber pb-1' : ''
            }`}
          >
            Submit
          </Link>
          <Link
            href="/browse"
            className={`transition-colors duration-200 hover:text-slate-100 ${
              isActive('/browse') ? 'text-slate-100 border-b border-brand-coral pb-1' : ''
            }`}
          >
            Browse
          </Link>
          <Link
            href="/search"
            className={`transition-colors duration-200 hover:text-slate-100 ${
              isActive('/search') ? 'text-slate-100 border-b border-brand-teal pb-1' : ''
            }`}
          >
            Search
          </Link>
          {isSignedIn && (
            <Link
              href="/dashboard"
              className={`transition-colors duration-200 hover:text-slate-100 ${
                isActive('/dashboard') ? 'text-slate-100 border-b border-amber-500/20 pb-1' : ''
              }`}
            >
              Dashboard
            </Link>
          )}
          {isSignedIn && isAdmin && (
            <Link
              href="/admin/dashboard"
              className={`transition-colors duration-200 hover:text-slate-100 text-red-400/90 hover:text-red-400 ${
                isActive('/admin/dashboard') ? 'text-red-400 border-b border-red-500/50 pb-1' : ''
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Auth / Action Section */}
        <div className="flex items-center gap-4">
          {/* Mobile nav icons */}
          <div className="flex md:hidden items-center gap-2 text-slate-400">
            <Link href="/submit" className={`p-1 ${isActive('/submit') ? 'text-brand-amber' : ''}`} title="Submit">
              <PlusCircle className="h-5 w-5" />
            </Link>
            <Link href="/browse" className={`p-1 ${isActive('/browse') ? 'text-brand-amber' : ''}`} title="Browse">
              <Layers className="h-5 w-5" />
            </Link>
            <Link href="/search" className={`p-1 ${isActive('/search') ? 'text-brand-teal' : ''}`} title="Search">
              <Search className="h-5 w-5" />
            </Link>
            {isSignedIn && (
              <Link href="/dashboard" className={`p-1 ${isActive('/dashboard') ? 'text-amber-500/80' : ''}`} title="Dashboard">
                <LayoutDashboard className="h-5 w-5" />
              </Link>
            )}
            {isSignedIn && isAdmin && (
              <Link href="/admin/dashboard" className={`p-1 ${isActive('/admin/dashboard') ? 'text-red-400' : ''}`} title="Admin Dashboard">
                <ShieldCheck className="h-5 w-5" />
              </Link>
            )}
          </div>

          {isSignedIn ? (
            <UserButton appearance={clerkUserButtonAppearance} />
          ) : (
            <div className="flex items-center gap-3">
              <Show when={'signed-out'}>
                <SignInButton mode="modal">
                  <button className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-slate-100 transition-colors cursor-pointer px-3 py-1.5">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="font-mono text-[10px] uppercase tracking-widest bg-gradient-to-r from-brand-amber to-brand-coral hover:opacity-90 text-slate-950 font-bold px-3 py-1 rounded transition-all active:scale-95 cursor-pointer shadow-lg shadow-brand-amber/10">
                    <span className="hidden sm:inline">Quick Frustration Check</span>
                    <span className="sm:hidden">Quick Check</span>
                  </button>
                </SignUpButton>
              </Show>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
