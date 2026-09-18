import React, { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { SetupScreen } from "./components/SetupScreen";
import { EmpireBoard } from "./components/EmpireBoard";
import { StudyPanel } from "./components/StudyPanel";
import { QuizModal } from "./components/QuizModal";
import { ResourceBar } from "./components/ResourceBar";
import { Toast } from "./components/Toast";
import { generateTopicTree, generateQuiz, fileToBase64 } from "./lib/api";
import { levelFromXP } from "./lib/utils";

export default function App() {
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState(null);
  const [xpMap, setXpMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [points, setPoints] = useState(0);
  const [gems, setGems] = useState(0);
  const [streak, setStreak] = useState(0);

  const [sessionActive, setSessionActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const selectedTopic = topics?.find((t) => t.id === selectedId) || null;

  async function handleGenerate({ subject: subj, text, imageFile }) {
    setLoading(true);
    setError("");
    try {
      let imageBase64, imageMimeType;
      if (imageFile) {
        imageBase64 = await fileToBase64(imageFile);
        imageMimeType = imageFile.type || "image/jpeg";
      }
      const json = await generateTopicTree({ subject: subj, text, imageBase64, imageMimeType });
      setTopics(json.topics);
      setSubject(subj);
      setXpMap({});
    } catch (e) {
      setError(e.message || "Something went wrong generating your empire.");
    } finally {
      setLoading(false);
    }
  }

  function startSession(minutes) {
    setSessionActive(true);
    setSecondsLeft(minutes * 60);
  }

  useEffect(() => {
    if (!sessionActive) return;
    if (secondsLeft <= 0) {
      finishSession();
      return;
    }
    timerRef.current = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, secondsLeft]);

  async function finishSession() {
    setSessionActive(false);
    clearTimeout(timerRef.current);
    setLoading(true);
    setError("");
    try {
      const json = await generateQuiz({ subject, topicName: selectedTopic.name });
      setQuiz({ topicId: selectedTopic.id, topicName: selectedTopic.name, questions: json.questions });
      setAnswers({});
    } catch (e) {
      setError(e.message);
      showToast("Couldn't generate quiz — check the server and try again.");
    } finally {
      setLoading(false);
    }
  }

  function submitQuiz() {
    setSubmitting(true);
    const correct = quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length;
    const total = quiz.questions.length;
    const xpGain = Math.round((correct / total) * 60);
    const newXp = (xpMap[quiz.topicId] || 0) + xpGain;

    setXpMap((prev) => ({ ...prev, [quiz.topicId]: newXp }));
    setPoints((p) => p + correct * 10);
    setGems((g) => g + (correct === total ? 3 : correct > 0 ? 1 : 0));
    setStreak((s) => s + (correct > 0 ? 1 : 0));

    setTimeout(() => {
      setSubmitting(false);
      setQuiz(null);
      showToast(
        correct === total
          ? `Perfect score — ${quiz.topicName} reached Level ${levelFromXP(newXp)}.`
          : `${correct}/${total} correct — ${quiz.topicName} is now Level ${levelFromXP(newXp)}.`
      );
    }, 400);
  }

  if (!topics) {
    return (
      <>
        <SetupScreen onGenerate={handleGenerate} loading={loading} error={error} />
        <Toast message={toast} />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-teal-dark">
              <Sparkles size={12} />
              Gyan Empire
            </div>
            <h1 className="font-display font-semibold text-lg leading-tight">{subject}</h1>
          </div>
          <ResourceBar points={points} gems={gems} streak={streak} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div>
          <h2 className="font-display font-semibold text-sm text-muted mb-4">Your empire</h2>
          <EmpireBoard topics={topics} xpMap={xpMap} onSelectTopic={setSelectedId} selectedId={selectedId} />
        </div>
        <div className="space-y-4">
          <StudyPanel
            topic={selectedTopic}
            onStart={startSession}
            sessionActive={sessionActive}
            secondsLeft={secondsLeft}
            onFinish={finishSession}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </main>

      <QuizModal
        quiz={quiz}
        answers={answers}
        onAnswer={(i, oi) => setAnswers((a) => ({ ...a, [i]: oi }))}
        onSubmit={submitQuiz}
        submitting={submitting}
        onClose={() => setQuiz(null)}
      />
      <Toast message={toast} />
    </div>
  );
}
