"use client";

import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { LessonFormData, ModuleWithLessons, Lesson } from "@/types/course";
import {
  createLesson,
  updateLesson,
  deleteLesson,
} from "@/lib/supabase-course";
import { uploadToS3, deleteFromS3, extractS3Key } from "@/lib/s3Upload";

interface Props {
  courseId: string;
  modules: ModuleWithLessons[];
  onModulesChange: (modules: ModuleWithLessons[]) => void;
  onFinish: () => void;
  onBack: () => void;
}

const EMPTY_LESSON: LessonFormData = {
  title: "",
  content: "",
  video_url: "",
  order: 1,
  order_index: 1,
  duration_secs: 0,
  notes: "",
  is_preview: false,
};

interface EditingState {
  moduleId: string;
  lessonId: string | null; // null = new lesson
}

export default function Step3Lessons({
  courseId,
  modules,
  onModulesChange,
  onFinish,
  onBack,
}: Props) {
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >(
    // Expand all modules by default
    Object.fromEntries(modules.map((m) => [m.id, true]))
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [form, setForm] = useState<LessonFormData>(EMPTY_LESSON);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof LessonFormData, string>>
  >({});

  function setField<K extends keyof LessonFormData>(
    key: K,
    value: LessonFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }

  function getLessonsForModule(moduleId: string): Lesson[] {
    return modules.find((m) => m.id === moduleId)?.lessons || [];
  }

  function startAdd(moduleId: string) {
    const lessons = getLessonsForModule(moduleId);
    setEditing({ moduleId, lessonId: null });
    setForm({
      ...EMPTY_LESSON,
      order: lessons.length + 1,
      order_index: lessons.length + 1,
    });
    setVideoFileName(null);
    setErrors({});
    // Expand module
    setExpandedModules((prev) => ({ ...prev, [moduleId]: true }));
  }

  function startEdit(moduleId: string, lesson: Lesson) {
    setEditing({ moduleId, lessonId: lesson.id });
    setForm({
      title: lesson.title,
      content: lesson.content || "",
      video_url: lesson.video_url || "",
      order: lesson.order,
      order_index: lesson.order_index,
      duration_secs: lesson.duration_secs || 0,
      notes: lesson.notes || "",
      is_preview: lesson.is_preview,
    });
    setVideoFileName(
      lesson.video_url ? lesson.video_url.split("/").pop() || null : null
    );
    setErrors({});
    setExpandedModules((prev) => ({ ...prev, [moduleId]: true }));
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_LESSON);
    setVideoFileName(null);
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof LessonFormData, string>> = {};
    if (!form.title.trim()) newErrors.title = "Lesson title is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploadingVideo(true);
  setVideoFileName(file.name);

  try {
    // delete old video from S3 if replacing
    if (form.video_url?.includes('amazonaws.com')) {
      const key = extractS3Key(form.video_url, 'courses');
      if (key) await deleteFromS3(key);
    }

    const url = await uploadToS3(file, 'courses');
    setField("video_url", url);

    // auto-set duration
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setField("duration_secs", Math.round(video.duration));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  } catch (err) {
    console.error(err);
    alert("Failed to upload video. Please try again.");
    setVideoFileName(null);
  } finally {
    setUploadingVideo(false);
  }
}

async function removeVideo() {
  if (form.video_url?.includes('amazonaws.com')) {
    const key = extractS3Key(form.video_url, 'courses');
    if (key) await deleteFromS3(key);
  }

  setField("video_url", "");
  setVideoFileName(null);
  if (videoInputRef.current) videoInputRef.current.value = "";
}

  async function handleSave() {
    if (!validate() || !editing) return;
    setSaving(true);

    try {
      if (editing.lessonId) {
        // Update
        const updated = await updateLesson(editing.lessonId, {
          ...form,
          order_index: form.order,
        });
        onModulesChange(
          modules.map((m) =>
            m.id === editing.moduleId
              ? {
                  ...m,
                  lessons: m.lessons.map((l) =>
                    l.id === editing.lessonId ? { ...l, ...updated } : l
                  ),
                }
              : m
          )
        );
      } else {
        // Create
        const lessons = getLessonsForModule(editing.moduleId);
        const created = await createLesson(editing.moduleId, {
          ...form,
          order: lessons.length + 1,
          order_index: lessons.length + 1,
        });
        onModulesChange(
          modules.map((m) =>
            m.id === editing.moduleId
              ? { ...m, lessons: [...m.lessons, created] }
              : m
          )
        );
      }

      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Failed to save lesson. Please try again.");
    } finally {
      setSaving(false);
    }
  }

async function handleDelete(moduleId: string, lesson: Lesson) {
  if (!confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;

  setDeletingId(lesson.id);
  try {
    await deleteLesson(lesson.id);

    onModulesChange(
      modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) }
          : m
      )
    );

    if (editing?.lessonId === lesson.id) cancelEdit();

    // clean up S3 video in the background
    if (lesson.video_url?.includes('amazonaws.com')) {
      const key = extractS3Key(lesson.video_url, 'courses');
      if (key) await deleteFromS3(key);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to delete lesson. Please try again.");
  } finally {
    setDeletingId(null);
  }
}

  const totalLessons = modules.reduce(
    (acc, m) => acc + (m.lessons?.length || 0),
    0
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Add lessons to each module
        </p>
      </div>

      {/* Modules list */}
      <div className="space-y-4">
        {modules.map((mod) => {
          const isExpanded = expandedModules[mod.id];
          const isEditingInThisModule = editing?.moduleId === mod.id;
          const lessons = mod.lessons || [];

          return (
            <div
              key={mod.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center justify-between px-4 py-3
                  bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <Layers size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-900">
                    {mod.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
              </button>

              {/* Lessons inside module */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {/* Existing lessons */}
                  {lessons.map((lesson) => {
                    const isEditingThis =
                      editing?.lessonId === lesson.id &&
                      editing?.moduleId === mod.id;

                    return (
                      <div key={lesson.id}>
                        {/* Lesson row */}
                        {!isEditingThis && (
                          <div className="flex items-center justify-between px-4 py-3
                            hover:bg-gray-50 transition group">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText
                                size={15}
                                className="text-gray-400 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 truncate">
                                  {lesson.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {lesson.is_preview && (
                                    <span className="text-xs bg-green-100 text-green-700
                                      px-2 py-0.5 rounded-full font-medium">
                                      Free preview
                                    </span>
                                  )}
                                  {lesson.video_url && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <Video size={11} />
                                      Video
                                    </span>
                                  )}
                                  {lesson.duration_secs ? (
                                    <span className="text-xs text-gray-400">
                                      {Math.round(lesson.duration_secs / 60)}min
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0
                              group-hover:opacity-100 transition flex-shrink-0">
                              <button
                                onClick={() => startEdit(mod.id, lesson)}
                                disabled={!!deletingId}
                                className="p-1.5 text-gray-400 hover:text-blue-600
                                  hover:bg-blue-100 rounded-lg transition"
                                title="Edit lesson"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(mod.id, lesson)}
                                disabled={deletingId === lesson.id}
                                className="p-1.5 text-gray-400 hover:text-red-600
                                  hover:bg-red-100 rounded-lg transition"
                                title="Delete lesson"
                              >
                                {deletingId === lesson.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline edit form for this lesson */}
                        {isEditingThis && (
                          <div className="px-4 py-4 bg-blue-50 border-t border-blue-100">
                            <LessonForm
                              form={form}
                              errors={errors}
                              saving={saving}
                              uploadingVideo={uploadingVideo}
                              videoFileName={videoFileName}
                              isEditing={true}
                              videoInputRef={videoInputRef}
                              setField={setField}
                              onSave={handleSave}
                              onCancel={cancelEdit}
                              onVideoUpload={handleVideoUpload}
                              onRemoveVideo={removeVideo}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* New lesson form */}
                  {isEditingInThisModule && !editing?.lessonId && (
                    <div className="px-4 py-4 bg-blue-50 border-t border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 mb-3">
                        New lesson
                      </p>
                      <LessonForm
                        form={form}
                        errors={errors}
                        saving={saving}
                        uploadingVideo={uploadingVideo}
                        videoFileName={videoFileName}
                        isEditing={false}
                        videoInputRef={videoInputRef}
                        setField={setField}
                        onSave={handleSave}
                        onCancel={cancelEdit}
                        onVideoUpload={handleVideoUpload}
                        onRemoveVideo={removeVideo}
                      />
                    </div>
                  )}

                  {/* Add lesson button */}
                  {!isEditingInThisModule && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <button
                        onClick={() => startAdd(mod.id)}
                        className="flex items-center gap-1.5 text-sm text-blue-600
                          hover:text-blue-700 font-medium transition"
                      >
                        <Plus size={14} />
                        Add lesson
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No modules warning */}
      {modules.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No modules found. Go back and add modules first.
        </div>
      )}

      {/* Summary */}
      {totalLessons > 0 && (
        <p className="text-xs text-gray-400">
          {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} across{" "}
          {modules.length} module{modules.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300
            text-sm text-gray-600 hover:bg-gray-100 transition font-medium"
        >
          ← Back to modules
        </button>

        <button
          onClick={onFinish}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5
            rounded-lg hover:bg-blue-700 transition font-medium text-sm"
        >
          ✓ Done
        </button>
      </div>
    </div>
  );
}

// ─── Shared lesson form ────────────────────────────────────────────────────────

interface LessonFormProps {
  form: LessonFormData;
  errors: Partial<Record<keyof LessonFormData, string>>;
  saving: boolean;
  uploadingVideo: boolean;
  videoFileName: string | null;
  isEditing: boolean;
videoInputRef: React.RefObject<HTMLInputElement | null>
  setField: <K extends keyof LessonFormData>(
    key: K,
    value: LessonFormData[K]
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // in the interface
onRemoveVideo: () => Promise<void>;
}

function LessonForm({
  form,
  errors,
  saving,
  uploadingVideo,
  videoFileName,
  isEditing,
  videoInputRef,
  setField,
  onSave,
  onCancel,
  onVideoUpload,
  onRemoveVideo,
}: LessonFormProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">
          Lesson title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="e.g., Understanding the basics"
          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white
            transition focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.title ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title}</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Content</label>
        <textarea
          value={form.content}
          onChange={(e) => setField("content", e.target.value)}
          placeholder="Enter lesson content, notes, or description..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            outline-none bg-white transition focus:ring-2 focus:ring-blue-500
            focus:border-blue-500 resize-none"
        />
      </div>

      {/* Video upload */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Video</label>

        {videoFileName ? (
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200
            rounded-lg">
            <Video size={18} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {videoFileName}
              </p>
              {uploadingVideo && (
                <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" />
                  Uploading...
                </p>
              )}
              {!uploadingVideo && form.video_url && (
                <p className="text-xs text-green-600 mt-0.5">Uploaded</p>
              )}
            </div>
            {!uploadingVideo && (
              <button
                onClick={onRemoveVideo}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <X size={13} className="text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed
              border-gray-300 rounded-lg text-gray-400 hover:border-blue-400
              hover:text-blue-500 transition text-sm"
          >
            <Upload size={15} />
            Click to upload video file
          </button>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onVideoUpload}
        />
      </div>

      {/* Duration + Order */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">
            Duration (seconds)
          </label>
          <input
            type="number"
            min={0}
            value={form.duration_secs}
            onChange={(e) => setField("duration_secs", Number(e.target.value))}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              outline-none bg-white transition focus:ring-2 focus:ring-blue-500
              focus:border-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">Order</label>
          <input
            type="number"
            min={1}
            value={form.order}
            onChange={(e) => {
              const val = Number(e.target.value);
              setField("order", val);
              setField("order_index", val);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              outline-none bg-white transition focus:ring-2 focus:ring-blue-500
              focus:border-blue-500"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">
          Notes{" "}
          <span className="text-gray-400 font-normal">— optional</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Additional notes for this lesson..."
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
            outline-none bg-white transition focus:ring-2 focus:ring-blue-500
            focus:border-blue-500 resize-none"
        />
      </div>

      {/* Free preview */}
      <label className="flex items-center gap-2.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={form.is_preview}
          onChange={(e) => setField("is_preview", e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        <span className="text-xs text-gray-700">
          Free preview{" "}
          <span className="text-gray-400">(visible without enrollment)</span>
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving || uploadingVideo}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2
            rounded-lg hover:bg-blue-700 transition text-sm font-medium
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          {saving ? "Saving..." : isEditing ? "Save changes" : "Add lesson"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600
            hover:bg-gray-100 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}