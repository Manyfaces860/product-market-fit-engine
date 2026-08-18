'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/lib/clerk';

interface LoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A highly styled, modern inline spinner primarily for buttons.
 */
export function ButtonSpinner({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  const dimensions = {
    xs: 'h-3.5 w-3.5 border-2',
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-[3px]',
  }[size];

  return (
    <div
      className={`${dimensions} rounded-full border-slate-950/25 border-t-slate-950 animate-spin`}
    />
  );
}

const BAR_CHARS = 10;

/**
 * A compact ASCII terminal loading bar (~80px wide) that fills left-to-right
 * with an amber -> red gradient, plus a blinking cursor and staged status text.
 */
export function PageScanner({ message = 'Analyzing...', size = 'md' }: LoaderProps) {
  const { user } = useUser();
  const userName = user ? `${user.firstName || ''}`.trim() : 'Builder';
  const [progress, setProgress] = useState(0);
  const [displayMessage, setDisplayMessage] = useState(message);

  useEffect(() => {
    setDisplayMessage(message);

    // Fill the ASCII bar with irregular increments for an organic feel
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 1 + Math.random() * 3));
    }, 100);

    // Stage 2 (after 3s): Reassure the user we are still actively working
    const timer1 = setTimeout(() => {
      setDisplayMessage('trying our best to get you data...');
    }, 3000);

    // Stage 3 (after 6s): Suggest a browser reload and personalize with their name!
    const timer2 = setTimeout(() => {
      setDisplayMessage(`you might have to re load the page, our server is stuck, perform a quick reload ${userName}`);
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [message, userName]);

  const barSize = size === 'sm' ? 'text-[8px] w-16' : 'text-[10px] w-20';
  const filled = Math.round((progress / 100) * BAR_CHARS);

  // If size is 'sm' (used inline), use tighter padding.
  // Otherwise, use 'min-h-[60vh]' to ensure perfect vertical and horizontal page centering on viewports!
  const containerClass = size === 'sm'
    ? 'flex flex-col items-center justify-center py-6 px-4 w-full relative'
    : 'flex flex-col items-center justify-center min-h-[60vh] py-16 px-4 w-full relative';

  return (
    <div className={containerClass}>
      <div className={`${barSize} flex items-center justify-center font-mono leading-none whitespace-nowrap select-none`}>
        <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 bg-clip-text text-transparent">
          {'█'.repeat(filled)}
        </span>
        <span className="text-slate-700">{'░'.repeat(BAR_CHARS - filled)}</span>
        {/* <span className="text-amber-500 animate-pulse">▊</span> */}
      </div>

      {displayMessage && (
        <p className="mt-3 font-mono text-[9px] tracking-[0.2em] text-slate-400 font-bold uppercase text-center animate-pulse max-w-md leading-relaxed">
          {displayMessage}
        </p>
      )}
    </div>
  );
}