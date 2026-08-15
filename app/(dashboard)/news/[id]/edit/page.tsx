"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save } from "lucide-react";

export default function EditArticlePage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    content: "",
    status: "draft",
  });

  useEffect(() => {
    async function fetchArticle() {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("id", id)
        .single();

      if (error) console.error(error);
      else setForm({
        title:   data.title   || "",
        slug:    data.slug    || "",
        content: data.content || "",
        status:  data.status  || "draft",
      });
      setLoading(false);
    }
    fetchArticle();
  }, [id]);

  // Auto-generate slug from title
  const handleTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert("Title is required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("news")
      .update(form)
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to save. Please try again.");
    } else {
      router.push("/news");
    }

    setSaving(false);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.push("/news")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft size={18} /> Back to News
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Article</h1>
        <p className="mt-1 text-gray-600">Update your news article</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-6">

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Article title..."
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Slug <span className="text-gray-400 text-xs">(auto-generated)</span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="article-slug"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Content</label>
          <textarea
            rows={12}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Write your article content here..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <button
            onClick={() => router.push("/news")}
            className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}