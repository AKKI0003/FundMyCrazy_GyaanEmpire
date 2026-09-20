import React, { useCallback, useEffect, useRef, useState } from "react";
import { SetupScreen } from "./components/SetupScreen";
import { BaseScreen } from "./components/BaseScreen";
import { SubjectBoard } from "./components/SubjectBoard";
import { LessonPage } from "./components/LessonPage";
import { QuizModal } from "./components/QuizModal";
import { WrittenResponseModal, WRITTEN_MAX_POINTS } from "./components/WrittenResponseModal";
import { Toast } from "./components/Toast";
import { useBase } from "./game/baseState";
import { usePlayerSync } from "./game/usePlayerSync";
import { loadPlayer } from "./game/player";
import {
  generateTopicTree,
  generateQuiz,
  generateLesson,
  generateWrittenPrompt,
  gradeWrittenAnswer,
  getTopicVideos,
  fileToBase64,
} from "./lib/api";
import { levelFromXP } from "./lib/utils";

const XP_PER_TOPIC_MAX = 60 * 7;

// What the student was actually taught for a topic — the source every quiz is written from.
const lessonPartsFor = (sub, topic) =>
  (sub.lessonHistory[topic.id] || []).map(({ title, explanation, keyPoints }) => ({ title, explanation, keyPoints }));

const SUBJECTS_KEY = "gyanEmpire.subjects.v1";
const LEGACY_EMPIRE_KEY = "gyanEmpire.state.v3"; // pre-multi-subject save, migrated once below
const STREAK_KEY = "gyanEmpire.streak.v1";
const TOTAL_STAGES = 5;
const WATCH_VIDEO_POINTS = 3;

function partsForDuration(minutes) {
  if (minutes >= 25) return 3;
  if (minutes >= 15) return 2;
  return 1;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const { date, streak } = JSON.parse(raw);
    if (date === todayKey() || date === yesterdayKey()) return streak;
    return 0;
  } catch {
    return 0;
  }
}

function bumpStreak() {
  const today = todayKey();
  let next = 1;
  let milestone = null;
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const { date, streak } = JSON.parse(raw);
      next = date === today ? streak : date === yesterdayKey() ? streak + 1 : 1;
    }
  } catch {
    // fall back to next = 1
  }
  localStorage.setItem(STREAK_KEY, JSON.stringify({ date: today, streak: next }));
  if ([3, 7, 14, 30].includes(next)) milestone = next;
  return { streak: next, milestone };
}

function emptySubjectFields() {
  return {
    xpMap: {},
    masteryTier: 0,
    lessonProgress: {},
    lessonHistory: {},
    askedQuestions: {},
    unlockedEarly: {},
  };
}

function loadSubjectsState() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.subjects) return parsed;
    }
  } catch {
    // fall through to legacy migration
  }
  // One-time migration from the pre-multi-subject save format.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_EMPIRE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.topics?.length) {
        return {
          subjects: [
            {
              id: "subj_legacy",
              subject: legacy.subject || "My subject",
              syllabusText: legacy.syllabusText || "",
              topics: legacy.topics,
              xpMap: legacy.xpMap || {},
              masteryTier: legacy.masteryTier || 0,
              lessonProgress: legacy.lessonProgress || {},
              lessonHistory: legacy.lessonHistory || {},
              askedQuestions: legacy.askedQuestions || {},
              unlockedEarly: legacy.unlockedEarly || {},
            },
          ],
          points: legacy.points || 0,
          gems: legacy.gems || 0,
        };
      }
    }
  } catch {
    // fall through to empty
  }
  return { subjects: [], points: 0, gems: 0 };
}

export default function App() {
  const savedData = useRef(loadSubjectsState()).current;

  const [subjects, setSubjects] = useState(savedData.subjects || []);
  const [points, setPoints] = useState(savedData.points || 0);
  const [gems, setGems] = useState(savedData.gems || 0);
  const [streak, setStreak] = useState(() => loadStreak());
  // watchedVideos is a flat set keyed by YouTube video id (not per-subject —
  // a given video watched once shouldn't pay out again just because it also
  // surfaces under a different subject).
  const [watchedVideos, setWatchedVideos] = useState(savedData.watchedVideos || {});

  // "base" = your island (castle + one building per subject + shop items).
  // "setup" = creating a new subject. "board" = a single subject's topic map.
  // "lesson" = the full-page study view. activeSubjectId scopes board/lesson
  // to one subject's data.
  const [view, setView] = useState(subjects.length === 0 ? "setup" : "base");
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [lessonBusyTopicId, setLessonBusyTopicId] = useState(null);
  // Fetched once per (subject, topic) pair — not persisted, just refetches
  // on revisit. Composite-keyed because two different subjects can produce
  // topics with the same slug id.
  const [topicVideos, setTopicVideos] = useState({});

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [writtenTask, setWrittenTask] = useState(null); // { topicId, topicName, prompt }
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenLoadingPrompt, setWrittenLoadingPrompt] = useState(false);
  const [writtenSubmitting, setWrittenSubmitting] = useState(false);
  const [writtenReviewing, setWrittenReviewing] = useState(false);
  const [writtenResult, setWrittenResult] = useState(null);

  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    const h = (e) => showToast(e.detail);
    window.addEventListener("gyan:toast", h);
    return () => window.removeEventListener("gyan:toast", h);
  }, [showToast]);

  // ---- game layer: gems economy, base layout, multiplayer identity ---------
  const [player, setPlayer] = useState(() => loadPlayer());
  const spendGems = useCallback(
    (n) => {
      if (gems < n) return false;
      setGems((g) => g - n);
      return true;
    },
    [gems]
  );
  const addGems = useCallback((n) => n && setGems((g) => g + n), []);
  const addPoints = useCallback((n) => n && setPoints((p) => p + n), []);
  const baseApi = useBase({ subjects, spendGems, gems, toast: showToast });
  const { online } = usePlayerSync({ player, base: baseApi.base, subjects });

  // A board/lesson whose subject vanished (deleted elsewhere) falls back to the base.
  useEffect(() => {
    if ((view === "board" || view === "lesson") && !activeSubject) setView("base");
  }, [view, activeSubject]);

  const selectedTopic = activeSubject?.topics?.find((t) => t.id === selectedId) || null;

  function updateSubject(id, updater) {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const patch = typeof updater === "function" ? updater(s) : updater;
        return { ...s, ...patch };
      })
    );
  }

  useEffect(() => {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify({ subjects, points, gems, watchedVideos }));
  }, [subjects, points, gems, watchedVideos]);

  function goToBase() {
    setActiveSubjectId(null);
    setSelectedId(null);
    setView("base");
  }

  async function createSubject({ subject: subj, text, imageFile }) {
    setLoading(true);
    setError("");
    try {
      let imageBase64, imageMimeType;
      if (imageFile) {
        imageBase64 = await fileToBase64(imageFile);
        imageMimeType = imageFile.type || "image/jpeg";
      }
      const json = await generateTopicTree({ subject: subj, text, imageBase64, imageMimeType });
      const id = `subj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newSubject = {
        id,
        subject: subj,
        syllabusText: text || "",
        topics: json.topics,
        ...emptySubjectFields(),
      };
      setSubjects((prev) => [...prev, newSubject]);
      setActiveSubjectId(null);
      setSelectedId(null);
      setView("base");
      showToast(`🏗️ ${subj} is now a building on your island — tap it to study.`);
    } catch (e) {
      setError(e.message || "Something went wrong generating this subject.");
    } finally {
      setLoading(false);
    }
  }

  function deleteSubject(id) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (activeSubjectId === id) goToBase();
  }

  function ensureVideos(topic) {
    if (!activeSubject || !topic) return;
    const key = `${activeSubject.id}:${topic.id}`;
    if (topicVideos[key]) return;
    setTopicVideos((prev) => ({ ...prev, [key]: [] })); // mark in-flight
    getTopicVideos({ topicName: topic.name, subject: activeSubject.subject }).then(({ videos }) => {
      if (videos?.length) setTopicVideos((prev) => ({ ...prev, [key]: videos }));
    });
  }

  function watchVideo(videoId) {
    if (watchedVideos[videoId]) return; // only pays out the first time
    setWatchedVideos((prev) => ({ ...prev, [videoId]: true }));
    setPoints((p) => p + WATCH_VIDEO_POINTS);
    showToast(`+${WATCH_VIDEO_POINTS} points for checking out that video.`);
  }

  // Spend gems to skip a topic's prerequisite and unlock it right now.
  function unlockTopicEarly(topic, cost) {
    if (!activeSubject || gems < cost) return;
    setGems((g) => g - cost);
    updateSubject(activeSubject.id, (s) => ({ unlockedEarly: { ...s.unlockedEarly, [topic.id]: true } }));
    showToast(`🔓 ${topic.name} unlocked early for ${cost} gems.`);
  }

  // Crossing every 10% of a subject's overall mastery pays out gems on its
  // own — computed inline wherever a subject's xpMap changes, rather than a
  // global effect scanning every subject on every render.
  function applyMasteryMilestone(subject, newXpMap) {
    const totalXp = subject.topics.reduce((s, t) => s + (newXpMap[t.id] || 0), 0);
    const maxXp = subject.topics.length * XP_PER_TOPIC_MAX;
    const pct = Math.round((totalXp / maxXp) * 100);
    const tier = Math.floor(pct / 10);
    if (tier > subject.masteryTier) {
      return { newMasteryTier: tier, gemsGained: (tier - subject.masteryTier) * 5, pct: tier * 10 };
    }
    return { newMasteryTier: subject.masteryTier, gemsGained: 0, pct: null };
  }

  async function advanceLesson(topic, minutes) {
    const sub = activeSubject;
    if (!sub) return;
    const already = sub.lessonProgress[topic.id] || 0;
    if (already >= TOTAL_STAGES) return;
    const toFetch = Math.min(partsForDuration(minutes), TOTAL_STAGES - already);
    setLessonBusyTopicId(topic.id);
    // Accumulated locally (not read back from state) because several parts
    // can be fetched in this same loop before a re-render ever happens.
    const historySoFar = [...(sub.lessonHistory[topic.id] || [])];
    for (let i = 0; i < toFetch; i++) {
      const partIndex = already + i;
      try {
        const priorSections = historySoFar.map((p) => ({
          title: p.title,
          keyPoints: p.keyPoints,
          openingExcerpt: (p.explanation || "").slice(0, 160),
        }));
        const json = await generateLesson({ subject: sub.subject, topicName: topic.name, partIndex, syllabusText: sub.syllabusText, priorSections });
        const newPart = { partIndex, title: json.title, summary: json.summary || "", sections: json.sections || [], explanation: json.explanation, keyPoints: json.keyPoints || [] };
        historySoFar.push(newPart);
        updateSubject(sub.id, (s) => ({
          lessonHistory: { ...s.lessonHistory, [topic.id]: [...(s.lessonHistory[topic.id] || []), newPart] },
          lessonProgress: { ...s.lessonProgress, [topic.id]: partIndex + 1 },
        }));
      } catch (e) {
        showToast("Couldn't load the next part of the lesson right now.");
        break;
      }
    }
    setLessonBusyTopicId((id) => (id === topic.id ? null : id));
  }

  function startSession(minutes) {
    setSessionActive(true);
    setSessionMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setView("lesson");
    if (selectedTopic) {
      advanceLesson(selectedTopic, minutes);
      ensureVideos(selectedTopic);
    }
  }

  function resumeLesson(topic) {
    setSelectedId(topic.id);
    setView("lesson");
    ensureVideos(topic);
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

  async function runQuiz(topic, minutes) {
    const sub = activeSubject;
    if (!sub) return;
    setLoading(true);
    setError("");
    try {
      const partsCovered = Math.max(sub.lessonProgress[topic.id] || 1, 1);
      const previousQuestions = sub.askedQuestions[topic.id] || [];
      const json = await generateQuiz({
        subject: sub.subject,
        topicName: topic.name,
        minutes,
        excludeQuestions: previousQuestions,
        syllabusText: sub.syllabusText,
        // The quiz is written from the lesson text this student actually read.
        lessonParts: lessonPartsFor(sub, topic),
      });
      setQuiz({ topicId: topic.id, topicName: topic.name, minutes, questions: json.questions });
      setAnswers({});
      setReviewing(false);
      updateSubject(sub.id, (s) => ({
        askedQuestions: {
          ...s.askedQuestions,
          [topic.id]: [...(s.askedQuestions[topic.id] || []), ...json.questions.map((q) => q.question)].slice(-20),
        },
      }));
    } catch (e) {
      setError(e.message);
      showToast("Couldn't generate quiz — check the server and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function finishSession() {
    setSessionActive(false);
    clearTimeout(timerRef.current);
    await runQuiz(selectedTopic, sessionMinutes);
  }

  function retakeQuiz(topic) {
    setSelectedId(topic.id);
    setView("lesson");
    runQuiz(topic, sessionMinutes);
  }

  function submitQuiz() {
    const sub = activeSubject;
    if (!sub) return;
    setSubmitting(true);
    const correct = quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length;
    const total = quiz.questions.length;
    const xpGain = Math.round((correct / total) * 60);
    const newXp = (sub.xpMap[quiz.topicId] || 0) + xpGain;
    const newLevel = levelFromXP(newXp);
    const newXpMap = { ...sub.xpMap, [quiz.topicId]: newXp };

    const { newMasteryTier, gemsGained: milestoneGems, pct: milestonePct } = applyMasteryMilestone(sub, newXpMap);
    updateSubject(sub.id, () => ({ xpMap: newXpMap, masteryTier: newMasteryTier }));

    setPoints((p) => p + correct * 10);
    let gemGain = (correct === total ? 3 : correct > 0 ? 1 : 0) + milestoneGems;

    let extraMessage = milestonePct ? ` 🏰 ${sub.subject} milestone — ${milestonePct}% conquered: +${milestoneGems} gems!` : "";
    if (correct > 0) {
      const { streak: newStreak, milestone } = bumpStreak();
      setStreak(newStreak);
      if (milestone) {
        const bonus = milestone * 5;
        gemGain += bonus;
        extraMessage += ` 🔥 ${milestone}-day streak bonus: +${bonus} gems!`;
      }
    }
    setGems((g) => g + gemGain);

    setTimeout(() => {
      setSubmitting(false);
      setLastResult({ correct, total, xpGain, newLevel });
      setReviewing(true);
      showToast(
        (correct === total
          ? `Perfect score — ${quiz.topicName} reached Level ${newLevel}.`
          : `${correct}/${total} correct — ${quiz.topicName} is now Level ${newLevel}.`) + extraMessage
      );
    }, 400);
  }

  function cancelQuiz() {
    setQuiz(null);
    setAnswers({});
  }

  function closeQuiz() {
    setQuiz(null);
    setReviewing(false);
    setLastResult(null);
    setAnswers({});
    setView("board");
  }

  // --- Written response ("write it out — more points") -------------------
  async function openWrittenTask(topic) {
    const sub = activeSubject;
    if (!sub || !topic) return;
    setWrittenTask({ topicId: topic.id, topicName: topic.name, prompt: "" });
    setWrittenAnswer("");
    setWrittenReviewing(false);
    setWrittenResult(null);
    setWrittenLoadingPrompt(true);
    try {
      const partsCovered = Math.max(sub.lessonProgress[topic.id] || 1, 1);
      const { prompt } = await generateWrittenPrompt({ subject: sub.subject, topicName: topic.name, partsCovered, syllabusText: sub.syllabusText, lessonParts: lessonPartsFor(sub, topic) });
      setWrittenTask({ topicId: topic.id, topicName: topic.name, prompt });
    } catch (e) {
      showToast("Couldn't load a written prompt right now.");
      setWrittenTask(null);
    } finally {
      setWrittenLoadingPrompt(false);
    }
  }

  async function submitWrittenAnswer() {
    const sub = activeSubject;
    if (!sub || !writtenTask || !writtenAnswer.trim()) return;
    setWrittenSubmitting(true);
    try {
      const { score, feedback } = await gradeWrittenAnswer({
        subject: sub.subject,
        topicName: writtenTask.topicName,
        prompt: writtenTask.prompt,
        answer: writtenAnswer,
        syllabusText: sub.syllabusText,
      });
      const xpGain = Math.round((score / 100) * 60);
      const pointsGained = Math.round((score / 100) * WRITTEN_MAX_POINTS);
      const newXp = (sub.xpMap[writtenTask.topicId] || 0) + xpGain;
      const newLevel = levelFromXP(newXp);
      const newXpMap = { ...sub.xpMap, [writtenTask.topicId]: newXp };

      const { newMasteryTier, gemsGained: milestoneGems, pct: milestonePct } = applyMasteryMilestone(sub, newXpMap);
      updateSubject(sub.id, () => ({ xpMap: newXpMap, masteryTier: newMasteryTier }));

      setPoints((p) => p + pointsGained);
      let gemGain = (score >= 90 ? 3 : score > 0 ? 1 : 0) + milestoneGems;
      setGems((g) => g + gemGain);

      setWrittenResult({ score, feedback, pointsGained, xpGain, newLevel });
      setWrittenReviewing(true);
      showToast(
        `Scored ${score}/100 on ${writtenTask.topicName} — +${pointsGained} points, now Level ${newLevel}.` +
          (milestonePct ? ` 🏰 ${sub.subject} milestone — ${milestonePct}% conquered: +${milestoneGems} gems!` : "")
      );
    } catch (e) {
      showToast("Couldn't grade that answer — try again in a moment.");
    } finally {
      setWrittenSubmitting(false);
    }
  }

  function cancelWritten() {
    setWrittenTask(null);
    setWrittenAnswer("");
  }
  function closeWritten() {
    setWrittenTask(null);
    setWrittenAnswer("");
    setWrittenReviewing(false);
    setWrittenResult(null);
  }

  // --- Views ---------------------------------------------------------------

  if (view === "setup") {
    return (
      <>
        <SetupScreen
          onGenerate={createSubject}
          loading={loading}
          error={error}
          onCancel={subjects.length > 0 ? goToBase : undefined}
        />
        <Toast message={toast} />
      </>
    );
  }

  if (view === "base" || !activeSubject) {
    return (
      <>
        <BaseScreen
          subjects={subjects}
          baseApi={baseApi}
          gems={gems}
          points={points}
          streak={streak}
          player={player}
          setPlayer={setPlayer}
          online={online}
          onOpenSubject={(id) => {
            setActiveSubjectId(id);
            setSelectedId(null);
            setView("board");
          }}
          onAddSubject={() => setView("setup")}
          spendGems={spendGems}
          addGems={addGems}
          addPoints={addPoints}
          toast={showToast}
        />
        <Toast message={toast} />
      </>
    );
  }

  if (view === "lesson" && selectedTopic) {
    return (
      <>
        <LessonPage
          topic={selectedTopic}
          sessionActive={sessionActive}
          secondsLeft={secondsLeft}
          onFinish={finishSession}
          onBack={() => setView("board")}
          lessonHistory={activeSubject.lessonHistory[selectedTopic.id] || []}
          partsCompleted={activeSubject.lessonProgress[selectedTopic.id] || 0}
          totalParts={TOTAL_STAGES}
          lessonBusy={lessonBusyTopicId === selectedTopic.id}
          onRetakeQuiz={() => retakeQuiz(selectedTopic)}
          quizLoading={loading}
          videos={topicVideos[`${activeSubject.id}:${selectedTopic.id}`] || []}
          onWatchVideo={watchVideo}
          onWriteItOut={() => openWrittenTask(selectedTopic)}
        />
        <QuizModal
          quiz={quiz}
          answers={answers}
          onAnswer={(i, oi) => setAnswers((a) => ({ ...a, [i]: oi }))}
          onSubmit={submitQuiz}
          submitting={submitting}
          reviewing={reviewing}
          lastResult={lastResult}
          onCancel={cancelQuiz}
          onContinue={closeQuiz}
        />
        <WrittenResponseModal
          task={writtenTask}
          loadingPrompt={writtenLoadingPrompt}
          answer={writtenAnswer}
          onAnswerChange={setWrittenAnswer}
          onSubmit={submitWrittenAnswer}
          submitting={writtenSubmitting}
          reviewing={writtenReviewing}
          result={writtenResult}
          onCancel={cancelWritten}
          onContinue={closeWritten}
        />
        <Toast message={toast} />
      </>
    );
  }

  return (
    <>
      <SubjectBoard
        subject={activeSubject}
        gems={gems}
        points={points}
        streak={streak}
        selectedId={selectedId}
        onSelectTopic={setSelectedId}
        onBack={goToBase}
        onDelete={() => deleteSubject(activeSubject.id)}
        onUnlockEarly={unlockTopicEarly}
        error={error}
        studyProps={{
          onStart: startSession,
          partsCompleted: selectedTopic ? activeSubject.lessonProgress[selectedTopic.id] || 0 : 0,
          totalParts: TOTAL_STAGES,
          onResumeLesson: () => resumeLesson(selectedTopic),
          onRetakeQuiz: () => retakeQuiz(selectedTopic),
          quizLoading: loading,
        }}
      />
      <QuizModal
        quiz={quiz}
        answers={answers}
        onAnswer={(i, oi) => setAnswers((a) => ({ ...a, [i]: oi }))}
        onSubmit={submitQuiz}
        submitting={submitting}
        reviewing={reviewing}
        lastResult={lastResult}
        onCancel={cancelQuiz}
        onContinue={closeQuiz}
      />
      <Toast message={toast} />
    </>
  );
}
