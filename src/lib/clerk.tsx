'use client';

import * as clerkReal from '@clerk/nextjs';
import { useEffect, useState } from 'react';

// Simple cookie helper for E2E testing
function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function useAuth() {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      const id = getCookie('e2e_user_id');
      setUserId(id);
      setIsLoaded(true);
    }, []);

    return {
      isSignedIn: !!userId,
      userId,
      isLoaded,
    };
  }
  return clerkReal.useAuth();
}

export function useUser() {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const [user, setUser] = useState<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      const id = getCookie('e2e_user_id');
      const email = getCookie('e2e_user_email') || 'test@needboard.space';
      const name = getCookie('e2e_user_name') || 'Test User';
      const role = getCookie('e2e_user_role') || 'user';

      if (id) {
        setUser({
          id,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' '),
          fullName: name,
          primaryEmailAddress: { emailAddress: email },
          emailAddresses: [{ emailAddress: email }],
          publicMetadata: { role },
        });
      } else {
        setUser(null);
      }
      setIsLoaded(true);
    }, []);

    return {
      isSignedIn: !!user,
      user,
      isLoaded,
    };
  }
  return clerkReal.useUser();
}

export function Show({ children, when, fallback = null }: any) {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const { isSignedIn } = useAuth();
    const show = when === 'signed-out' ? !isSignedIn : isSignedIn;
    return show ? children : fallback;
  }
  // Fallback to original clerk Show if available
  const RealShow = (clerkReal as any).Show;
  if (RealShow) {
    return <RealShow when={when} fallback={fallback}>{children}</RealShow>;
  }
  return children;
}

export function SignInButton({ children, ...props }: any) {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const handleClick = () => {
      document.cookie = "e2e_user_id=user_e2e_test_id; path=/";
      document.cookie = "e2e_user_name=E2E Tester; path=/";
      document.cookie = "e2e_user_role=user; path=/";
      document.cookie = "e2e_user_email=e2e@needboard.space; path=/";
      window.location.reload();
    };
    return <span onClick={handleClick} className="contents cursor-pointer">{children}</span>;
  }
  return <clerkReal.SignInButton {...props}>{children}</clerkReal.SignInButton>;
}

export function SignUpButton({ children, ...props }: any) {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const handleClick = () => {
      document.cookie = "e2e_user_id=user_e2e_test_id; path=/";
      document.cookie = "e2e_user_name=E2E Tester; path=/";
      document.cookie = "e2e_user_role=user; path=/";
      document.cookie = "e2e_user_email=e2e@needboard.space; path=/";
      window.location.reload();
    };
    return <span onClick={handleClick} className="contents cursor-pointer">{children}</span>;
  }
  return <clerkReal.SignUpButton {...props}>{children}</clerkReal.SignUpButton>;
}

export function UserButton(props: any) {
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const handleLogout = () => {
      document.cookie = "e2e_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "e2e_user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "e2e_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "e2e_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.reload();
    };
    return (
      <button 
        onClick={handleLogout} 
        data-testid="user-button-mock"
        className="font-mono text-[10px] tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded transition-all cursor-pointer border border-white/10"
      >
        Sign Out (Mock)
      </button>
    );
  }
  return <clerkReal.UserButton {...props} />;
}

export const ClerkProvider = process.env.NEXT_PUBLIC_E2E_TESTING === 'true'
  ? ({ children }: { children: React.ReactNode }) => children
  : clerkReal.ClerkProvider;
