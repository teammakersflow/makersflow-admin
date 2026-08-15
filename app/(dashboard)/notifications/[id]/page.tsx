"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar, Edit2, ExternalLink } from "lucide-react";

type NotificationItem = {
  id: string; title: string; message: string;
  type: string; link_url: string | null; status: string; created_at: string;
};

export default function ViewNotificationPage() {
  const router = useRouter();
  const { id } = useParams();
  const [item, setItem] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/announcements/${id}`)
      .then((r) => r.json())
      .then(({ data }) => { setItem(data); setLoading(false); });
  }, [id]);

  const statusColor = (s: string) =>
    s === "published" ? "bg-green-100 text-green-800"
    : s === "archived" ? "bg-orange-100 text-orange-800"
    : "bg-gray-100 text-gray-800";

  const typeColor = (t: string) =>
    t === "success" ? "bg-emerald-100 text-emerald-800"
    : t === "warning" ? "bg-amber-100 text-amber-800"
    : t === "announcement" ? "bg-purple-100 text-purple-800"
    : "bg-blue-100 text-blue-800";

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!item) return <div className="p-6 text-red-500">Notification not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => router.push("/notifications")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft size={18} /> Back to Notifications
      </button>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
            {item.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} />
            {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${typeColor(item.type)}`}>
            {item.type || "info"}
          </span>
          {item.link_url && (
            <a href={item.link_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink size={14} /> {item.link_url}
            </a>
          )}
        </div>

        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.message}</p>

        <div className="pt-4 border-t border-gray-100">
          <button onClick={() => router.push(`/notifications/${id}/edit`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">
            <Edit2 size={16} /> Edit Notification
          </button>
        </div>
      </div>
    </div>
  );
}
