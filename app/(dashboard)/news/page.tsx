"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Edit2, Trash2, Calendar, Eye } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
};

export default function NewsPage() {
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadArticles() {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setArticles(data || []);
    }

    loadArticles();
  }, []);

  const handleView = (id: string) => {
    router.push(`/news/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/news/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    const confirmed = confirm(
      "Are you sure you want to delete this article? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(id);

    const { error } = await supabase.from("news").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete article. Please try again.");
    } else {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    }

    setDeletingId(null);
  };

  const filteredArticles = articles.filter((article) =>
    article.title.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-100 text-green-800";
      case "draft":     return "bg-gray-100 text-gray-800";
      case "archived":  return "bg-orange-100 text-orange-800";
      default:          return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">News Articles</h1>
          <p className="mt-1 text-gray-600">Publish and manage news updates</p>
        </div>

        <button
          onClick={() => router.push("/news/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          <Plus size={18} />
          Add Article
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          placeholder="Search articles by title..."
          className="w-full max-w-md border border-gray-300 pl-10 pr-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Title</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Published</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Status</th>
              <th className="text-center px-6 py-3 text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredArticles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center">
                  <div className="text-gray-600 font-medium">
                    {search ? "No articles found matching your search" : "No articles yet"}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {!search && "Publish your first news article to get started"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredArticles.map((article) => (
                <tr
                  key={article.id}
                  className="border-t border-gray-200 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{article.title}</p>
                    {article.slug && (
                      <p className="text-xs text-gray-400 mt-0.5">/news/{article.slug}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {article.created_at
                        ? new Date(article.created_at).toLocaleDateString()
                        : "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}
                    >
                      {article.status
                        ? article.status.charAt(0).toUpperCase() + article.status.slice(1)
                        : "Draft"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">

                      {/* VIEW */}
                      <button
                        onClick={() => handleView(article.id)}
                        title="View article"
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                      >
                        <Eye size={16} />
                      </button>

                      {/* EDIT */}
                      <button
                        onClick={() => handleEdit(article.id)}
                        title="Edit article"
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => handleDelete(article.id)}
                        title="Delete article"
                        disabled={deletingId === article.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                      </button>

                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      {filteredArticles.length > 0 && (
        <div className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-semibold text-gray-900">{filteredArticles.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-gray-900">{articles.length}</span>{" "}
          articles
        </div>
      )}
    </div>
  );
}