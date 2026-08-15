'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Sparkles, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * A beautiful, modern, theme-consistent alert modal replacing standard JavaScript alert() boxes.
 * Features glassmorphic backdrops, glowing icons, and smooth spring animations.
 */
export default function AlertModal({
  isOpen,
  type = 'success',
  title,
  message,
  onClose,
}: AlertModalProps) {
  
  // Icon and theme config based on modal type
  const themeConfig = {
    success: {
      icon: <Check className="h-6 w-6 text-teal-400" />,
      circleClass: "bg-teal-500/20 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]",
      buttonClass: "bg-gradient-to-r from-teal-500 to-brand-teal text-slate-950 hover:opacity-90",
      accentGlow: "bg-teal-500/5",
    },
    error: {
      icon: <AlertTriangle className="h-6 w-6 text-red-400" />,
      circleClass: "bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      buttonClass: "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:opacity-90",
      accentGlow: "bg-red-500/5",
    },
    info: {
      icon: <Sparkles className="h-6 w-6 text-amber-400" />,
      circleClass: "bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
      buttonClass: "bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 hover:opacity-90",
      accentGlow: "bg-amber-500/5",
    },
  }[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-4">
          
          {/* Backdrop Blur */}
          <motion.div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Card Content */}
          <motion.div
            className="relative bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 sm:p-8 shadow-2xl overflow-hidden text-center backdrop-blur-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          >
            {/* Subtle glow spot */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 ${themeConfig.accentGlow} rounded-full blur-3xl pointer-events-none`} />

            {/* Close Button X */}
            <button
              onClick={onClose}
              data-testid="modal-cross-button"
              className="modal-cross-button absolute top-4 right-4 p-1.5 text-slate-500 hover:text-slate-100 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Glowing Type Icon */}
            <div className={`mx-auto w-12 h-12 rounded-full border flex items-center justify-center mb-5 animate-bounce ${themeConfig.circleClass}`}>
              {themeConfig.icon}
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-bold font-display italic text-slate-100 leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed font-sans max-w-xs mx-auto">
              {message}
            </p>

            {/* CTA Button */}
            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`w-full h-10 font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center ${themeConfig.buttonClass}`}
              >
                Dismiss
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
