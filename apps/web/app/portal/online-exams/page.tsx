"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { Award, CheckCircle2, ChevronLeft, Clock, Loader2, PlayCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ExamSummary = {
  id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  startAt: string;
  endAt: string;
  window: "not_started" | "open" | "closed";
};
type AttemptSummary = { examId: string; obtainedMarks: number; totalMarks: number; percent: number };
type Question = { id: string; prompt: string; options: string[]; marks: number };
type Attempt = {
  id: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
  window: "open" | "not_started" | "closed";
};
type Result = { obtainedMarks: number; totalMarks: number; correct: number; wrong: number; unanswered: number };

function OnlineExams() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const submittedRef = useRef(false);

  const studentQuery = selectedChildId ? `?studentId=${encodeURIComponent(selectedChildId)}` : "";

  const load = useCallback(() => {
    if (!selectedChildId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    adminApiRequest<{ exams: ExamSummary[]; attempts: AttemptSummary[] }>(`/api/portal/online-exams${studentQuery}`, { signal: controller.signal })
      .then((data) => {
        setExams(data.exams ?? []);
        setAttempts(data.attempts ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unable to load online exams.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedChildId, studentQuery]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const submit = useCallback(async () => {
    if (!active || !selectedChildId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const response = await adminApiRequest<{ result: Result }>(`/api/portal/online-exams/${active.id}`, {
        method: "POST",
        body: JSON.stringify({ studentId: selectedChildId, answers })
      });
      setResult(response.result);
      setActive(null);
      load();
    } catch (err) {
      submittedRef.current = false;
      setError(err instanceof Error ? err.message : "Unable to submit exam.");
    } finally {
      setSubmitting(false);
    }
  }, [active, answers, load, selectedChildId]);

  useEffect(() => {
    if (active && remaining === 0 && !submittedRef.current) void submit();
  }, [active, remaining, submit]);

  async function start(exam: ExamSummary) {
    if (!selectedChildId) return;
    setError(null);
    setResult(null);
    submittedRef.current = false;
    try {
      const data = await adminApiRequest<{ exam: { title: string; durationMinutes: number; window: "open" | "not_started" | "closed" }; questions: Question[] }>(
        `/api/portal/online-exams/${exam.id}${studentQuery}`
      );
      if (data.exam.window !== "open") {
        setError(data.exam.window === "not_started" ? "This exam has not started yet." : "This exam window has closed.");
        return;
      }
      setAnswers({});
      setActive({ id: exam.id, title: data.exam.title, durationMinutes: data.exam.durationMinutes, questions: data.questions, window: data.exam.window });
      setRemaining(Math.max(1, data.exam.durationMinutes) * 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start exam.");
    }
  }

  const attemptFor = (examId: string) => attempts.find((attempt) => attempt.examId === examId);

  if (childrenLoading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-muted-foreground">Loading...</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Online Tests"
        description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : "Attempt online tests and view results"}
      />
      <section className="space-y-4 p-4 md:p-7">
        {children.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <button key={child.id} type="button" onClick={() => switchChild(child.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${child.id === selectedChildId ? "bg-[#3033a1] text-white" : "bg-muted text-muted-foreground"}`}>
                {child.name}
              </button>
            ))}
          </div>
        )}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {active ? (
          <div className="space-y-4">
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1f2136]">{active.title}</h3>
                <p className="text-xs font-semibold text-muted-foreground">{active.questions.length} questions · One attempt only</p>
              </div>
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ${remaining <= 60 ? "bg-[#ffebed] text-[#ed515d]" : "bg-[#eef0ff] text-[#3033a1]"}`}>
                <Clock size={15} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </div>
            </div>
            {active.questions.map((question, index) => (
              <div key={question.id} className="card space-y-3 p-4">
                <p className="text-sm font-bold text-[#303247]">{index + 1}. {question.prompt} <span className="font-medium text-muted-foreground">({question.marks} mark{question.marks === 1 ? "" : "s"})</span></p>
                <div className="grid gap-2">
                  {question.options.map((option, optionIndex) => (
                    <button key={optionIndex} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${answers[question.id] === optionIndex ? "border-[#3033a1] bg-[#eef0ff] text-[#3033a1]" : "border-[#e0e3f0] bg-white text-[#303247]"}`}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => void submit()} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit test
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setActive(null); setAnswers({}); }} disabled={submitting}><ChevronLeft size={16} /> Back</button>
            </div>
          </div>
        ) : result ? (
          <div className="card space-y-2 p-6 text-center">
            <Award className="mx-auto text-[#14a762]" size={36} />
            <h3 className="text-lg font-extrabold text-[#1f2136]">Test submitted</h3>
            <p className="text-3xl font-extrabold text-[#3033a1]">{result.obtainedMarks} / {result.totalMarks}</p>
            <p className="text-sm font-semibold text-muted-foreground">Correct {result.correct} · Wrong {result.wrong} · Skipped {result.unanswered}</p>
            <button type="button" className="btn-secondary mx-auto" onClick={() => setResult(null)}>Back to tests</button>
          </div>
        ) : loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-muted-foreground"><Loader2 className="mx-auto animate-spin" size={20} /></div>
        ) : exams.length === 0 ? (
          <div className="card p-8 text-center text-sm font-semibold text-muted-foreground">No online tests are open for this class right now.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {exams.map((exam) => {
              const attempt = attemptFor(exam.id);
              return (
                <div key={exam.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-[#1f2136]">{exam.title}</h3>
                      <p className="text-xs font-semibold text-muted-foreground">{exam.subject || "General"} · {exam.questionCount} questions · {exam.durationMinutes} min</p>
                    </div>
                    {attempt ? (
                      <span className="rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#14a762]">Completed</span>
                    ) : exam.window === "open" ? (
                      <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1]">Available</span>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-500">{exam.window === "not_started" ? "Not started" : "Closed"}</span>
                    )}
                  </div>
                  {exam.description && <p className="text-xs font-medium text-muted-foreground">{exam.description}</p>}
                  {attempt ? (
                    <p className="text-sm font-bold text-[#3033a1]"><CheckCircle2 className="inline" size={15} /> Score {attempt.obtainedMarks}/{attempt.totalMarks} ({attempt.percent}%)</p>
                  ) : exam.window === "open" ? (
                    <button type="button" className="btn-primary self-start" onClick={() => void start(exam)}><PlayCircle size={16} /> Start test</button>
                  ) : (
                    <button type="button" className="btn-secondary self-start" disabled>
                      {exam.window === "not_started" ? "Opens later" : "Window closed"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default function PortalOnlineExamsPage() {
  return (
    <AppShell>
      <OnlineExams />
    </AppShell>
  );
}
