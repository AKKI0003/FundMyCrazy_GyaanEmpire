import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export function QuizModal({ quiz, answers, onAnswer, onSubmit, submitting, onClose }) {
  return (
    <AnimatePresence>
      {quiz && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-40"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <Card className="w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
              <h3 className="font-display font-semibold text-lg mb-4">Quick check — {quiz.topicName}</h3>
              <div className="space-y-5">
                {quiz.questions.map((q, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium mb-2">
                      {i + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          onClick={() => onAnswer(i, oi)}
                          className={cn(
                            "w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                            answers[i] === oi ? "border-teal bg-teal/5" : "border-border hover:border-teal"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  disabled={!quiz.questions.every((_, i) => answers[i] !== undefined) || submitting}
                  onClick={onSubmit}
                >
                  {submitting ? "Scoring..." : "Submit"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
