import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PenLine } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export const WRITTEN_MAX_POINTS = 40; // deliberately more than a single quiz question is worth

export function WrittenResponseModal({
  task, // { topicName, prompt } | null — null closes the modal
  loadingPrompt,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  reviewing,
  result, // { score, feedback, pointsGained, xpGain, newLevel } once graded
  onCancel,
  onContinue,
}) {
  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-40"
        >
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}>
            <Card className="w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
              {!reviewing ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-dark mb-1">
                    <PenLine size={13} />
                    Write it out · worth up to {WRITTEN_MAX_POINTS} points
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-3">{task.topicName}</h3>

                  {loadingPrompt ? (
                    <p className="text-sm text-muted py-6 text-center">Thinking of a good question...</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-3">{task.prompt}</p>
                      <textarea
                        value={answer}
                        onChange={(e) => onAnswerChange(e.target.value)}
                        placeholder="Answer in your own words — a few real sentences score much higher than a one-liner."
                        rows={7}
                        className="w-full text-sm rounded-lg border border-border px-3 py-2.5 focus:outline-none focus:border-teal resize-none"
                      />
                      <p className="text-[11px] text-muted mt-1.5">Graded on understanding, not just correctness — vague answers score lower.</p>
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-6">
                    <p className="text-[11px] text-muted">Cancelling costs nothing — you can come back to this anytime.</p>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" onClick={onCancel}>
                        Cancel
                      </Button>
                      <Button disabled={loadingPrompt || !answer.trim() || submitting} onClick={onSubmit}>
                        {submitting ? "Grading..." : "Submit"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-semibold text-lg mb-1">
                    {result?.score >= 85 ? "Great answer!" : result?.score >= 50 ? "Good effort" : "Here's some feedback"}
                  </h3>
                  <p className="text-sm text-muted mb-4">
                    Score {result?.score}/100 · +{result?.pointsGained} points · +{result?.xpGain} XP · now Level {result?.newLevel}
                  </p>
                  <div className="rounded-lg border border-border p-3 mb-3">
                    <p className="text-xs font-semibold text-muted mb-1">Your answer</p>
                    <p className="text-sm whitespace-pre-wrap">{answer}</p>
                  </div>
                  <div className="rounded-lg border border-teal/30 bg-teal/5 p-3">
                    <p className="text-xs font-semibold text-teal-dark mb-1">Feedback</p>
                    <p className="text-sm leading-relaxed">{result?.feedback}</p>
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
