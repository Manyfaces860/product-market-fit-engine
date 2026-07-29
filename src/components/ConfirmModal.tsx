'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  type?: 'info' | 'warning';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * A beautiful, theme-appropriate modal replacing standard browser confirm() boxes.
 * Features an interactive layout, spring actions, and custom status warning configurations.
 */
export default function ConfirmModal({
  isOpen,
  type = 'info',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  
  // Custom theme configurations matching our brand design layers
  const themeConfig = {
    info: {
      icon: <HelpCircle className="h-6 w-6 text-amber-400" />,
      circleClass: "bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
      confirmButtonClass: "bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 hover:opacity-90",
      accentGlow: "bg-amber-500/5",
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-red-400" />,
      circleClass: "bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      confirmButtonClass: "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:opacity-90",
      accentGlow: "bg-red-500/5",
    },
  }[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-4">
          
          {/* Glassmorphic Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container Card */}
          <motion.div
            className="relative bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 sm:p-8 shadow-2xl overflow-hidden text-center backdrop-blur-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          >
            {/* Ambient aesthetic glow spot */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 ${themeConfig.accentGlow} rounded-full blur-3xl pointer-events-none`} />

            {/* Close Button Cross */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-slate-100 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Pulsing Header Icon */}
            <div className={`mx-auto w-12 h-12 rounded-full border flex items-center justify-center mb-5 animate-bounce ${themeConfig.circleClass}`}>
              {themeConfig.icon}
            </div>

            {/* Title & Narrative */}
            <h3 className="text-xl font-bold font-display italic text-slate-100 leading-snug px-2">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed font-sans max-w-xs mx-auto">
              {message}
            </p>

            {/* Action CTA Buttons grid (Cancel & Confirm) */}
            <div className="mt-7 pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 font-mono text-xs uppercase tracking-wider font-bold rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-white/5"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`w-full h-10 font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center ${themeConfig.confirmButtonClass}`}
              >
                {confirmText}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}