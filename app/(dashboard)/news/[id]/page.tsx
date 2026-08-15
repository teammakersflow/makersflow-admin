"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Calendar, Edit2 } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  created_at: string;
};

export default function ViewArticlePage() {
  const router = useRouter();
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticle() {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("id", id)
        .single();

      if (error) console.error(error);
      else setArticle(data);
      setLoading(false);
    }
    fetchArticle();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-100 text-green-800";
      case "draft":     return "bg-gray-100 text-gray-800";
      case "archived":  return "bg-orange-100 text-orange-800";
      default:          return "bg-blue-100 text-blue-800";
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!article) return <div className="p-6 text-red-500">Article not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.push("/news")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft size={18} /> Back to News
      </button>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-6">

        {/* Title + status */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
          <span className={`shrink-0 inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}>
            {article.status
              ? article.status.charAt(0).toUpperCase() + article.status.slice(1)
              : "Draft"}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-6 text-sm text-gray-500 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} />
            {new Date(article.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          {article.slug && (
            <div className="text-gray-400">
              /news/<span className="text-gray-600">{article.slug}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {article.content || (
            <span className="text-gray-400 italic">No content available.</span>
          )}
        </div>

        {/* Edit button */}
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push(`/news/${id}/edit`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Edit2 size={16} />
            Edit Article
          </button>
        </div>
      </div>
    </div>
  );
}