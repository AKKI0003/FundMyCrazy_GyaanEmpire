import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

function quizMeta(quiz) {
  if (!quiz) return null;
  const n = quiz.questions.length;
  const minutes = quiz.minutes || 5;
  const tag = minutes >= 25 ? "Deep dive" : minutes >= 15 ? "Applied" : "Quick check";
  return `${n} question${n === 1 ? "" : "s"} · ${tag}`;
}

export function QuizModal({ quiz, answers, onAnswer, onSubmit, submitting, reviewing, lastResult, onCancel, onContinue }) {
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
              {!reviewing ? (
                <>
                  <h3 className="font-display font-semibold text-lg mb-1">{quiz.topicName}</h3>
                  <p className="text-xs text-muted mb-4">{quizMeta(quiz)}</p>
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
                  <div className="flex items-center justify-between gap-2 mt-6">
                    <p className="text-[11px] text-muted">Cancelling keeps your lesson progress — you can retake this quiz anytime.</p>
                    <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" onClick={onCancel}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!quiz.questions.every((_, i) => answers[i] !== undefined) || submitting}
                      onClick={onSubmit}
                    >
                      {submitting ? "Scoring..." : "Submit"}
                    </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-semibold text-lg mb-1">
                    {lastResult?.correct === lastResult?.total ? "Perfect!" : "Here's how you did"}
                  </h3>
                  <p className="text-sm text-muted mb-4">
                    {lastResult?.correct}/{lastResult?.total} correct · +{lastResult?.xpGain} XP · now Level{" "}
                    {lastResult?.newLevel}
                  </p>
                  <div className="space-y-4">
                    {quiz.questions.map((q, i) => {
                      const userAnswer = answers[i];
                      const isCorrect = userAnswer === q.correctIndex;
                      return (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium mb-2 flex items-start gap-1.5">
                            {isCorrect ? (
                              <Check size={16} className="text-teal shrink-0 mt-0.5" />
                            ) : (
                              <X size={16} className="text-danger shrink-0 mt-0.5" />
                            )}
                            <span>
                              {i + 1}. {q.question}
                            </span>
                          </p>
                          <div className="space-y-1 text-xs ml-6">
                            {q.options.map((opt, oi) => {
                              const isUserPick = oi === userAnswer;
                              const isCorrectPick = oi === q.correctIndex;
                              return (
                                <div
                                  key={oi}
                                  className={cn(
                                    "px-2 py-1.5 rounded-md border",
                                    isCorrectPick
                                      ? "border-teal bg-teal/5 text-teal-dark font-medium"
                                      : isUserPick
                                      ? "border-danger bg-danger/5 text-danger"
                                      : "border-transparent text-muted"
                                  )}
                                >
                                  {opt}
                                  {isCorrectPick && " ✓ correct answer"}
                                  {isUserPick && !isCorrectPick && " — your answer"}
                                </div>
                              );
                            })}
                          </div>
                          {q.explanation && (
                            <p className="text-xs text-muted mt-2 ml-6 leading-relaxed">{q.explanation}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button onClick={onContinue}>Continue</Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
