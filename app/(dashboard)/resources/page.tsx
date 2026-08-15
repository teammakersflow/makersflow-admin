"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Plus, Trash2, Paperclip, FileText, Link2, Video, ExternalLink } from "lucide-react";

// Manage per-lesson resources (PDFs, links, videos). Both the mobile app and
// the web app read lesson_resources for the lesson being watched.

type Course = { id: number; title: string };
type Module = { id: string; title: string };
type Lesson = { id: string; title: string };
type Resource = { id: string; title: string; url: string; type: string | null };

const TYPE_ICONS: Record<string, typeof FileText> = { pdf: FileText, link: Link2, video: Video };
const EMPTY = { title: "", url: "", type: "pdf" };

export default function ResourcesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    db.from("courses").select("id, title").order("title")
      .then(({ data }) => setCourses((data as Course[]) ?? []));
  }, []);

  useEffect(() => {
    setModules([]); setModuleId(""); setLessons([]); setLessonId(""); setResources([]);
    if (!courseId) return;
    db.from("modules").select("id, title").eq("course_id", courseId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setModules((data as Module[]) ?? []));
  }, [courseId]);

  useEffect(() => {
    setLessons([]); setLessonId(""); setResources([]);
    if (!moduleId) return;
    db.from("lessons").select("id, title").eq("module_id", moduleId)
      .order("order_index", { ascending: true })
      .then(({ data }) => setLessons((data as Lesson[]) ?? []));
  }, [moduleId]);

  const load = useCallback(async () => {
    if (!lessonId) { setResources([]); return; }
    const { data, error: err } = await db
      .from("lesson_resources")
      .select("id, title, url, type")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });
    setError(err ? err.message : "");
    setResources((data as Resource[]) ?? []);
  }, [lessonId]);

  useEffect(() => { load(); }, [load]);

  async function addResource() {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    let url = form.url.trim();
    if (!url) { setError("URL is required"); return; }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setSaving(true);
    const { error: err } = await db.from("lesson_resources").insert({
      lesson_id: lessonId,
      title: form.title.trim(),
      url,
      type: form.type,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this resource?")) return;
    await db.from("lesson_resources").delete().eq("id", id);
    load();
  }

  const selectCls = "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
        <p className="mt-1 text-gray-600">
          Attach PDFs, links and files to lessons — students see them in the app and web
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
            <h2 className="font-semibold text-gray-900">Add resource</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Arduino pinout cheat-sheet"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…/cheatsheet.pdf"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={selectCls}
              >
                <option value="pdf">PDF</option>
                <option value="link">Link</option>
                <option value="video">Video</option>
                <option value="zip">ZIP / File</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={addResource}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
            >
              <Plus size={16} /> {saving ? "Adding…" : "Add Resource"}
            </button>
          </div>

          {resources.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
              <Paperclip className="mx-auto mb-3 text-gray-300" size={36} />
              No resources for this lesson yet.
            </div>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => {
                const Icon = TYPE_ICONS[r.type ?? "link"] ?? Paperclip;
                return (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <Icon size={18} className="text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                      <p className="text-xs text-gray-500 truncate">{r.url}</p>
                    </div>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                       className="p-1.5 text-gray-400 hover:text-blue-600" title="Open">
                      <ExternalLink size={16} />
                    </a>
                    <button onClick={() => remove(r.id)} className="p-1.5 text-red-400 hover:text-red-600" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
