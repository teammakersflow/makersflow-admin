"use client";

import { useCallback, useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import { Plus, Trash2, HelpCircle, ChevronUp, ChevronDown } from "lucide-react";

// Manage quiz questions per lesson. The mobile app reads quiz_questions for a
// lesson_id; the web app reads the answer-free quiz_questions_public view.

type Course = { id: number; title: string };
type Module = { id: string; title: string };
type Lesson = { id: string; title: string };
type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  position: number;
};

const EMPTY_Q = { question_text: "", options: ["", "", "", ""], correct: 0 };

export default function QuizzesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(EMPTY_Q);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    backendApi
      .endpoint("/courses")
      .select("id, title")
      .order("title")
      .then(({ data }) => setCourses((data as Course[]) ?? []));
  }, []);

  useEffect(() => {
    setModules([]); setModuleId(""); setLessons([]); setLessonId(""); setQuestions([]);
    if (!courseId) return;
    backendApi
      .endpoint("/modules")
      .select("id, title")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setModules((data as Module[]) ?? []));
  }, [courseId]);

  useEffect(() => {
    setLessons([]); setLessonId(""); setQuestions([]);
    if (!moduleId) return;
    backendApi
      .endpoint("/lessons")
      .select("id, title")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setLessons((data as Lesson[]) ?? []));
  }, [moduleId]);

  const loadQuestions = useCallback(async () => {
    if (!lessonId) { setQuestions([]); return; }
    const { data, error: err } = await backendApi
      .endpoint("/quiz-questions")
      .select("id, question_text, options, correct_option_index, position")
      .eq("lesson_id", lessonId)
      .order("position", { ascending: true });
    setError(err ? err.message : "");
    setQuestions(
      ((data ?? []) as any[]).map((q) => ({
        ...q,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options ?? [],
      }))
    );
  }, [lessonId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  async function addQuestion() {
    setError("");
    const opts = form.options.map((o) => o.trim()).filter(Boolean);
    if (!form.question_text.trim()) { setError("Question text is required"); return; }
    if (opts.length < 2) { setError("At least 2 options are required"); return; }
    if (form.correct >= opts.length) { setError("Correct answer must be one of the options"); return; }
    setSaving(true);
    const { error: err } = await backendApi.endpoint("/quiz-questions").insert({
      lesson_id: lessonId,
      question_text: form.question_text.trim(),
      options: opts,
      correct_option_index: form.correct,
      position: questions.length,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY_Q);
    loadQuestions();
  }

  async function removeQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    await backendApi.endpoint("/quiz-questions").delete().eq("id", id);
    loadQuestions();
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= questions.length) return;
    const a = questions[index], b = questions[other];
    await Promise.all([
      backendApi.endpoint("/quiz-questions").update({ position: other }).eq("id", a.id),
      backendApi.endpoint("/quiz-questions").update({ position: index }).eq("id", b.id),
    ]);
    loadQuestions();
  }

  const selectCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quizzes</h1>
        <p className="mt-1 text-gray-600">
          Add quiz questions to lessons — students take them in the app and on the web
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
            <option value="">Select course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={selectCls} disabled={!courseId}>
            <option value="">Select module…</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lesson</label>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className={selectCls} disabled={!moduleId}>
            <option value="">Select lesson…</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
      </div>

      {lessonId && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Add question</h2>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              placeholder="What does an LED stand for?"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correct === i}
                    onChange={() => setForm({ ...form, correct: i })}
                    title="Mark as correct answer"
                  />
                  <input
                    value={opt}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[i] = e.target.value;
                      setForm({ ...form, options });
                    }}
                    placeholder={`Option ${i + 1}${form.correct === i ? " (correct)" : ""}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={addQuestion}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
            >
              <Plus size={16} /> {saving ? "Adding…" : "Add Question"}
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
              <HelpCircle className="mx-auto mb-3 text-gray-300" size={36} />
              No questions for this lesson yet.
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="mt-0.5 text-xs font-bold text-gray-400 w-6">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {q.options.map((o, oi) => (
                        <span
                          key={oi}
                          className={`text-xs px-2 py-1 rounded-full ${
                            oi === q.correct_option_index
                              ? "bg-green-100 text-green-700 font-semibold"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => move(i, -1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move up"><ChevronUp size={16} /></button>
                    <button onClick={() => move(i, 1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move down"><ChevronDown size={16} /></button>
                    <button onClick={() => removeQuestion(q.id)} className="p-1.5 text-red-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
