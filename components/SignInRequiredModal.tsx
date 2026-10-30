// components/SignInRequiredModal.tsx
//
// Shown instead of AddGelModal when a signed-out visitor clicks any "Add
// a Gel" button — see SetDetailClient.tsx's handleAddGelClick. Reuses the
// same sign-in box as the standalone /auth/signin page (see SignInBox.tsx).

"use client";

import { motion, AnimatePresence } from "framer-motion";
import SignInBox from "./SignInBox";

interface SignInRequiredModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  // Where to return to after signing in — defaults to wherever the modal
  // was opened from (the current page).
  callbackUrl?: string;
}

export default function SignInRequiredModal({ isOpen, onClose, callbackUrl }: SignInRequiredModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in required"
          >
            <div className="relative">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors duration-150"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <SignInBox callbackUrl={callbackUrl} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
