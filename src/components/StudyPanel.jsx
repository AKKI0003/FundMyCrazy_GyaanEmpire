import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export function StudyPanel({ topic, onStart, sessionActive, secondsLeft, onFinish }) {
  if (!topic) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">Select a topic on your board to start a study session.</p>
      </Card>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Card className="p-6">
      <div className="text-xs text-muted mb-1">Study session</div>
      <h3 className="font-display font-semibold text-lg mb-4">{topic.name}</h3>
      {!sessionActive ? (
        <div className="flex gap-2">
          {[5, 15, 25].map((min) => (
            <Button key={min} variant="secondary" size="sm" onClick={() => onStart(min)}>
              {min} min
            </Button>
          ))}
        </div>
      ) : (
        <div>
          <div className="font-display text-3xl font-bold mb-3 tabular-nums">
            {mm}:{ss}
          </div>
          <Button variant="secondary" size="sm" onClick={onFinish}>
            Finish early &amp; take quiz
          </Button>
        </div>
      )}
    </Card>
  );
}
