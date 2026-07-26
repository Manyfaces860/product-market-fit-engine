'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

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

/**
 * A stunning, futuristic, full-section or full-page radar scanner loader.
 * Perfect for matching vector spaces, compile statuses, or data queries.
 */
export function PageScanner({ message = 'Analyzing...', size = 'md' }: LoaderProps) {
  const scaleClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 w-full relative">
      <div className={`relative ${scaleClass} flex items-center justify-center`}>
        
        {/* Modern, high-contrast semantic pulsing ring radiating outwards */}
        <motion.div
          className="absolute inset-0 rounded-full border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{
            scale: [0.8, 2.2, 0.8],
            opacity: [0.8, 0, 0.8],
          }}
          transition={{
            duration: 2.0,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Second out-of-phase pulse ring to add depth and AI feel */}
        <motion.div
          className="absolute inset-0 rounded-full border border-teal-400/40 shadow-[0_0_15px_rgba(45,212,191,0.15)]"
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{
            scale: [0.8, 1.5, 0.8],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2.0,
            repeat: Infinity,
            delay: 0.6,
            ease: 'easeInOut',
          }}
        />

        {/* Core glowing dot (Brand Gradient) */}
        <div className="absolute inset-1 bg-gradient-to-tr from-brand-amber via-brand-coral to-brand-teal rounded-full shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center">
          <div className="w-full h-full bg-slate-950/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-slate-950" style={{ fill: 'rgba(15, 23, 42, 0.85)' }} />
          </div>
        </div>

      </div>

      {/* Modern, clean monospace text below */}
      {message && (
        <p className="mt-8 font-mono text-[9px] tracking-[0.2em] text-slate-400 font-bold uppercase text-center animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
