'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Show, useAuth, useUser, SignInButton, SignUpButton, UserButton } from '@/lib/clerk';
import { BinocularsIcon, Search, Layers, PlusCircle, LayoutDashboard, ShieldCheck } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
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
          <div className="flex md:hidden items-center gap-3 text-slate-400 mr-2">
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
            <UserButton appearance={{variables: {colorBackground: 'rgb(119 129 236 / 0.82)'}}} />
          ) : (
            <div className="flex items-center gap-3">
              <Show when={'signed-out'}>
                <SignInButton>
                  <button className="font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-slate-100 transition-colors cursor-pointer px-3 py-1.5">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="font-mono text-xs uppercase tracking-widest bg-gradient-to-r from-brand-amber to-brand-coral hover:opacity-90 text-slate-950 font-bold px-4 py-1.5 rounded transition-all active:scale-95 cursor-pointer shadow-lg shadow-brand-amber/10">
                    Quick Frustration Check
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
