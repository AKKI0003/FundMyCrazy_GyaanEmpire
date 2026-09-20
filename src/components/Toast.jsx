import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// The centering lives on a plain wrapper: framer-motion writes its own
// `transform` for the y animation, which would silently wipe a Tailwind
// -translate-x-1/2 on the same element and push the toast off-center.
export function Toast({ message }) {
  return (
    <div className="fixed bottom-28 left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-night-deep text-white text-sm font-medium px-4 py-3 rounded-xl border-2 border-gold shadow-lg max-w-sm text-center"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
