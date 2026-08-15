"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, StickyNote, ChevronUp, ChevronDown } from "lucide-react";

// Author "Key Learning Points" per lesson — shown in the app's Notes tab
// on the learning screen.

type Course = { id: number; title: string };
type Module = { id: string; title: string };
type Lesson = { id: string; title: string };
type Note = { id: string; content: string; position: number };

export default function LessonNotesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("courses").select("id, title").order("title")
      .then(({ data }) => setCourses((data as Course[]) ?? []));
  }, []);

  useEffect(() => {
    setModules([]); setModuleId(""); setLessons([]); setLessonId(""); setNotes([]);
    if (!courseId) return;
    supabase.from("modules").select("id, title").eq("course_id", courseId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setModules((data as Module[]) ?? []));
  }, [courseId]);

  useEffect(() => {
    setLessons([]); setLessonId(""); setNotes([]);
    if (!moduleId) return;
    supabase.from("lessons").select("id, title").eq("module_id", moduleId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setLessons((data as Lesson[]) ?? []));
  }, [moduleId]);

  const load = useCallback(async () => {
    if (!lessonId) { setNotes([]); return; }
    const { data } = await supabase
      .from("lesson_notes")
      .select("id, content, position")
      .eq("lesson_id", lessonId)
      .order("position", { ascending: true });
    setNotes((data as Note[]) ?? []);
  }, [lessonId]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    setError("");
    if (!content.trim()) { setError("Note text is required"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("lesson_notes").insert({
      lesson_id: lessonId,
      content: content.trim(),
      position: notes.length,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setContent("");
    load();
  }

  async function removeNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("lesson_notes").delete().eq("id", id);
    load();
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= notes.length) return;
    const a = notes[index], b = notes[other];
    await Promise.all([
      supabase.from("lesson_notes").update({ position: other }).eq("id", a.id),
      supabase.from("lesson_notes").update({ position: index }).eq("id", b.id),
    ]);
    load();
  }

  const selectCls = "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Lesson Notes</h1>
        <p className="mt-1 text-gray-600">
          Key learning points shown in the app&apos;s Notes tab for each lesson
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
            <h2 className="font-semibold text-gray-900">Add learning point</h2>
            <div className="flex gap-3">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                placeholder="An LED emits light when current flows through it"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={addNote}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50 whitespace-nowrap"
              >
                <Plus size={16} /> {saving ? "Adding…" : "Add Note"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {notes.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
              <StickyNote className="mx-auto mb-3 text-gray-300" size={36} />
              No notes for this lesson yet.
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n, i) => (
                <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  <p className="flex-1 text-sm text-gray-900">{n.content}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => move(i, -1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move up"><ChevronUp size={16} /></button>
                    <button onClick={() => move(i, 1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move down"><ChevronDown size={16} /></button>
                    <button onClick={() => removeNote(n.id)} className="p-1.5 text-red-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
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
