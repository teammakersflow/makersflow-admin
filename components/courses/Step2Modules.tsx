"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  GripVertical,
  Layers,
} from "lucide-react";
import { ModuleFormData, ModuleWithLessons } from "@/types/course";
import {
  createModule,
  updateModule,
  deleteModule,
} from "@/lib/supabase-course";

interface Props {
  courseId: string;
  modules: ModuleWithLessons[];
  onModulesChange: (modules: ModuleWithLessons[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const EMPTY_FORM: ModuleFormData = {
  title: "",
  order: 1,
  order_index: 1,
  duration_mins: 0,
};

export default function Step2Modules({
  courseId,
  modules,
  onModulesChange,
  onNext,
  onBack,
}: Props) {
  const [form, setForm] = useState<ModuleFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ModuleFormData, string>>>({});
  const [showForm, setShowForm] = useState(modules.length === 0);

  function set<K extends keyof ModuleFormData>(key: K, value: ModuleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ModuleFormData, string>> = {};
    if (!form.title.trim()) newErrors.title = "Module title is required";
    if (form.order < 1) newErrors.order = "Order must be at least 1";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function startEdit(mod: ModuleWithLessons) {
    setEditingId(mod.id);
    setForm({
      title: mod.title,
      order: mod.order,
      order_index: mod.order_index,
      duration_mins: mod.duration_mins || 0,
    });
    setShowForm(true);
    setErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      order: modules.length + 1,
      order_index: modules.length + 1,
    });
    setErrors({});
    setShowForm(false);
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    try {
      if (editingId) {
        // Update existing module
        const updated = await updateModule(editingId, {
          ...form,
          order_index: form.order,
        });
        onModulesChange(
          modules.map((m) =>
            m.id === editingId ? { ...m, ...updated } : m
          )
        );
      } else {
        // Create new module
        const nextOrder = modules.length + 1;
        const created = await createModule(courseId, {
          ...form,
          order: nextOrder,
          order_index: nextOrder,
        });
        onModulesChange([...modules, { ...created, lessons: [] }]);
      }

      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Failed to save module. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    if (
      !confirm(
        `Delete "${mod.title}"? All lessons inside will also be deleted.`
      )
    )
      return;

    setDeletingId(moduleId);
    try {
      await deleteModule(moduleId);
      onModulesChange(modules.filter((m) => m.id !== moduleId));
      if (editingId === moduleId) cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Failed to delete module. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleNext() {
    if (modules.length === 0) {
      alert("Add at least one module before continuing.");
      return;
    }
    onNext();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Modules</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Organize your course content into modules
        </p>
      </div>

      {/* Module list */}
      {modules.length > 0 && (
        <div className="space-y-3">
          {modules.map((mod, index) => (
            <div
              key={mod.id}
              className={`border rounded-lg p-4 transition ${
                editingId === mod.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs
                    font-semibold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {mod.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {mod.lessons?.length || 0} lesson
                      {(mod.lessons?.length || 0) !== 1 ? "s" : ""}
                      {mod.duration_mins
                        ? ` · ${mod.duration_mins} min`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(mod)}
                    disabled={!!deletingId}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100
                      rounded-lg transition disabled:opacity-40"
                    title="Edit module"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(mod.id)}
                    disabled={deletingId === mod.id}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100
                      rounded-lg transition disabled:opacity-40"
                    title="Delete module"
                  >
                    {deletingId === mod.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {modules.length === 0 && !showForm && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-10
          flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Layers size={22} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">No modules yet</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Add your first module to organize course content
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600
              hover:text-blue-700 font-medium transition"
          >
            <Plus size={15} />
            Add module
          </button>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {editingId ? "Edit module" : "New module"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Title */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Module title <span className="text-red-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g., Introduction to Basics"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none
                  bg-white transition focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors.title ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title}</p>
              )}
            </div>

            {/* Order */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Order</label>
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  set("order", val);
                  set("order_index", val);
                }}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none
                  bg-white transition focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors.order ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.order && (
                <p className="text-xs text-red-500">{errors.order}</p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5 max-w-xs">
            <label className="text-sm font-medium text-gray-700">
              Duration (minutes){" "}
              <span className="text-gray-400 font-normal">— optional</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.duration_mins}
              onChange={(e) => set("duration_mins", Number(e.target.value))}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                outline-none bg-white transition focus:ring-2 focus:ring-blue-500
                focus:border-blue-500"
            />
          </div>

          {/* Form actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg
                hover:bg-blue-700 transition text-sm font-medium
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {saving
                ? "Saving..."
                : editingId
                ? "Save changes"
                : "Add module"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600
                hover:bg-gray-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add module button (when list exists and form is hidden) */}
      {modules.length > 0 && !showForm && (
        <button
          onClick={() => {
            setForm({
              ...EMPTY_FORM,
              order: modules.length + 1,
              order_index: modules.length + 1,
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700
            font-medium transition"
        >
          <Plus size={15} />
          Add another module
        </button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300
            text-sm text-gray-600 hover:bg-gray-100 transition font-medium"
        >
          <ChevronUp size={16} className="rotate-[-90deg]" />
          Back
        </button>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg
            hover:bg-blue-700 transition font-medium text-sm"
        >
          Continue to lessons
          <ChevronDown size={16} className="rotate-[-90deg]" />
        </button>
      </div>
    </div>
  );
}