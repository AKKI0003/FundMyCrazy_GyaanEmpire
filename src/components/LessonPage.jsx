import React from "react";
import { ArrowLeft, GraduationCap, CheckCircle2, PlayCircle, PenLine } from "lucide-react";
import { Button } from "./ui/button";

function VideoStrip({ videos, onWatch }) {
  if (!videos?.length) return null;
  return (
    <div className="mt-10 pt-6 border-t border-border">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-dark mb-3">
        <PlayCircle size={13} />
        Watch more on this topic <span className="normal-case text-muted font-normal">· +3 points the first time you open one</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {videos.map((v) => (
          <a
            key={v.videoId}
            href={`https://www.youtube.com/watch?v=${v.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onWatch?.(v.videoId)}
            className="group rounded-lg border border-border overflow-hidden bg-white hover:border-teal transition-colors"
          >
            <div className="relative aspect-video bg-bg">
              {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                <PlayCircle size={28} className="text-white drop-shadow" />
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs font-medium leading-snug line-clamp-2">{v.title}</p>
              {v.channelTitle && <p className="text-[10px] text-muted mt-0.5">{v.channelTitle}</p>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// One section of a lesson part: heading, short body, then a list rendered by its
// style — numbered steps, bullets, or a term/definition table — and an optional callout.
function LessonSection({ section }) {
  const { heading, body, itemsStyle, items = [], callout } = section;
  const splitTerm = (it) => {
    const m = it.match(/^(.{1,60}?)\s+[—–-]\s+(.+)$/) || it.match(/^(.{1,60}?):\s+(.+)$/);
    return m ? [m[1], m[2]] : [null, it];
  };
  return (
    <section className="mt-6 first:mt-4">
      <h3 className="flex items-center gap-2 font-display font-semibold text-[16px] text-ink">
        <span className="w-1 h-4 rounded-full bg-teal shrink-0" />
        {heading}
      </h3>
      {body && <p className="text-[15px] leading-7 text-ink mt-1.5">{body}</p>}

      {items.length > 0 && itemsStyle === "steps" && (
        <ol className="mt-3 space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-teal text-white text-xs font-semibold grid place-items-center shrink-0">{i + 1}</span>
              <span className="text-[15px] leading-6 text-ink">{it}</span>
            </li>
          ))}
        </ol>
      )}

      {items.length > 0 && itemsStyle === "terms" && (
        <dl className="mt-3 rounded-lg border border-border bg-white divide-y divide-border">
          {items.map((it, i) => {
            const [term, def] = splitTerm(it);
            return (
              <div key={i} className="px-4 py-2.5 sm:grid sm:grid-cols-[170px_1fr] sm:gap-4">
                {term ? (
                  <>
                    <dt className="font-semibold text-[14px] text-teal-dark">{term}</dt>
                    <dd className="text-[14px] leading-6 text-ink">{def}</dd>
                  </>
                ) : (
                  <dd className="text-[14px] leading-6 text-ink sm:col-span-2">{def}</dd>
                )}
              </div>
            );
          })}
        </dl>
      )}

      {items.length > 0 && (itemsStyle === "bullets" || !["steps", "terms"].includes(itemsStyle)) && (
        <ul className="mt-2.5 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-6 text-ink">
              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
              {it}
            </li>
          ))}
        </ul>
      )}

      {callout && (
        <div className="mt-3.5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2.5 text-[14px] leading-6 text-ink">
          <span className="font-semibold text-amber">Tip · </span>
          {callout.replace(/^(tip|fix|note)\s*[:·-]\s*/i, "")}
        </div>
      )}
    </section>
  );
}

export function LessonPage({
  topic,
  sessionActive,
  secondsLeft,
  onFinish,
  onBack,
  lessonHistory,
  partsCompleted,
  totalParts,
  lessonBusy,
  onRetakeQuiz,
  quizLoading,
  videos = [],
  onWatchVideo,
  onWriteItOut,
}) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const isFullyTaught = partsCompleted >= totalParts;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} />
            Back to empire
          </button>
          {sessionActive && (
            <div className="font-display text-2xl font-bold tabular-nums">
              {mm}:{ss}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-xs font-medium text-teal-dark mb-2">
          <GraduationCap size={13} />
          Lesson · {partsCompleted}/{totalParts} taught
        </div>
        <h1 className="font-display font-bold text-3xl mb-1">{topic.name}</h1>

        <div className="h-1.5 rounded-full bg-border overflow-hidden my-6">
          <div
            className="h-full bg-teal rounded-full transition-all duration-500"
            style={{ width: `${(partsCompleted / totalParts) * 100}%` }}
          />
        </div>

        {/* No inner scroll box here on purpose — this is the whole page's
            content, so the page itself scrolls naturally instead of a
            cramped scrollable card. */}
        <div className="space-y-10">
          {lessonHistory.map((part) => (
            <article key={part.partIndex}>
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-dark mb-2">
                Part {part.partIndex + 1} of {totalParts}
              </div>
              <h2 className="font-display font-semibold text-xl">{part.title}</h2>
              {part.summary && <p className="text-[14.5px] text-muted mt-1">{part.summary}</p>}
              {part.sections?.length ? (
                <div>{part.sections.map((sec, i) => <LessonSection key={i} section={sec} />)}</div>
              ) : (
                // Lessons saved before the structured layout existed: show them as before.
                <p className="text-[15px] leading-7 text-ink whitespace-pre-line mt-3">{part.explanation}</p>
              )}
              {part.keyPoints?.length > 0 && (
                <ul className="mt-6 space-y-1.5 bg-white border border-border rounded-lg p-4">
                  <li className="text-xs font-semibold uppercase tracking-wide text-teal-dark mb-1">Key takeaways</li>
                  {part.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-teal shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        {lessonBusy && <p className="text-sm text-muted mt-8 animate-pulse">Teaching the next part...</p>}

        {isFullyTaught && !lessonBusy && (
          <div className="flex items-center gap-1.5 text-sm text-teal-dark mt-10 pt-6 border-t border-border">
            <CheckCircle2 size={15} />
            Fully covered — future sessions on this topic go straight to practice quizzes.
          </div>
        )}

        <VideoStrip videos={videos} onWatch={onWatchVideo} />

        <div className="mt-10 pt-6 border-t border-border flex items-center justify-end gap-3 flex-wrap">
          {partsCompleted > 0 && (
            <Button variant="ghost" onClick={onWriteItOut} disabled={lessonBusy}>
              <PenLine size={14} className="mr-1.5" />
              Write it out — more points
            </Button>
          )}
          {partsCompleted > 0 && (
            <Button variant="ghost" onClick={onRetakeQuiz} disabled={quizLoading || lessonBusy}>
              {quizLoading ? "Building quiz..." : "Take another quiz"}
            </Button>
          )}
          <Button onClick={onFinish} disabled={lessonBusy}>
            {isFullyTaught ? "Take the quiz" : "Finish early & take quiz"}
          </Button>
        </div>
      </main>
    </div>
  );
}
