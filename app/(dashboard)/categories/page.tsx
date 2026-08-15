"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2, Save, X, Tag } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  count?: number;
};

const emptyForm = { name: "", slug: "" };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  // ── Load categories with product counts ────────────────────
  useEffect(() => {
    async function loadCategories() {
      const [{ data: cats, error }, { data: products }] = await Promise.all([
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("products").select("category"),
      ]);

      if (error) { console.error(error); setLoading(false); return; }

      // Count products per category name
      const countMap: Record<string, number> = {};
      (products ?? []).forEach((p: { category: string }) => {
        if (p.category) countMap[p.category] = (countMap[p.category] ?? 0) + 1;
      });

      const withCounts = (cats ?? []).map(cat => ({
        ...cat,
        count: countMap[cat.name] ?? 0,
      }));
      setCategories(withCounts);
      setLoading(false);
    }

    loadCategories();
  }, []);

  // ── Auto-generate slug from name ───────────────────────────
  const handleNameChange = (value: string) => {
    setForm({
      name: value,
      slug: value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    });
  };

  // ── Open edit form ─────────────────────────────────────────
  const handleEditClick = (category: Category) => {
    setForm({ name: category.name, slug: category.slug });
    setEditingId(category.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Cancel form ────────────────────────────────────────────
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  // ── Save (create or update) ────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Category name is required.");
      return;
    }

    setSaving(true);

    if (editingId) {
      // UPDATE
      const { error } = await supabase
        .from("categories")
        .update({ name: form.name, slug: form.slug })
        .eq("id", editingId);

      if (error) {
        console.error(error);
        alert("Failed to update category.");
      } else {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingId ? { ...c, name: form.name, slug: form.slug } : c
          )
        );
        handleCancel();
      }
    } else {
      // CREATE
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: form.name, slug: form.slug })
        .select()
        .single();

      if (error) {
        console.error(error);
        alert("Failed to create category.");
      } else {
        setCategories((prev) => [...prev, data]);
        handleCancel();
      }
    }

    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirmed = confirm(
      "Are you sure you want to delete this category? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(id);

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to delete category.");
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }

    setDeletingId(null);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-gray-600">Organize your store with categories</p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus size={18} />
            Add Category
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingId ? "Edit Category" : "Create New Category"}
          </h3>

          <div className="space-y-4">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                placeholder="e.g., Web Development"
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Slug{" "}
                <span className="text-gray-400 text-xs">(auto-generated)</span>
              </label>
              <input
                placeholder="e.g., web-development"
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-generated from name. You can edit it manually if needed.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              <X size={16} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="text-5xl mb-4">🏷️</div>
          <p className="text-gray-900 font-medium">No categories created yet</p>
          <p className="text-gray-600 text-sm mt-2">
            Create your first category to organize your store products
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Name</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Slug</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Products</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="border-t border-gray-200 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag size={15} className="text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-sm">
                    {category.slug}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                      {category.count ?? 0} products
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">

                      {/* EDIT */}
                      <button
                        onClick={() => handleEditClick(category)}
                        title="Edit category"
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => handleDelete(category.id)}
                        title="Delete category"
                        disabled={deletingId === category.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                      </button>

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {categories.length > 0 && (
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{categories.length}</span>{" "}
          categor{categories.length !== 1 ? "ies" : "y"} total
        </div>
      )}
    </div>
  );
}