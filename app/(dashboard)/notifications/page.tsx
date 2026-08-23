"use client";

import { useEffect, useState } from "react";
import { formatDateLong } from "@/lib/format";
import { useRouter } from "next/navigation";
import { Search, Plus, Edit2, Trash2, Calendar, Eye, Bell, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { backendApi } from "@/lib/backend-api";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
  link_url?: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnnouncements() {
      setLoading(true);

      const { data, error } = await backendApi
        .endpoint("/announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[notifications] Failed to load announcements:", error);
        alert(error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as NotificationItem[]);
      }

      setLoading(false);
    }

    loadAnnouncements();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notification? This cannot be undone.")) {
      return;
    }

    setDeletingId(id);

    const { error } = await backendApi
      .endpoint("/announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "[notifications] Failed to delete announcement:",
        error,
      );

      alert(`Failed to delete: ${error.message}`);
    } else {
      setItems((prev) =>
        prev.filter((n) => String(n.id) !== String(id)),
      );
    }

    setDeletingId(null);
  };

  const filtered = items.filter((i) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.message ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || i.type === typeFilter;
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const statusColor = (s: string) =>
    s === "published" ? "bg-green-100 text-green-800"
    : s === "archived"  ? "bg-orange-100 text-orange-800"
    : "bg-gray-100 text-gray-800";

  const typeColor = (t: string) =>
    t === "success"      ? "bg-emerald-100 text-emerald-800"
    : t === "warning"    ? "bg-amber-100 text-amber-800"
    : t === "announcement" ? "bg-purple-100 text-purple-800"
    : "bg-blue-100 text-blue-800";

  const typeIcon = (t: string) => {
    switch(t) {
      case "success": return <CheckCircle size={14} className="text-emerald-600" />;
      case "warning": return <AlertTriangle size={14} className="text-amber-600" />;
      case "announcement": return <Bell size={14} className="text-purple-600" />;
      default: return <Info size={14} className="text-blue-600" />;
    }
  };

  const publishedCount = items.filter(i => i.status === "published").length;
  const draftCount = items.filter(i => i.status === "draft").length;
  const uniqueTypes = [...new Set(items.map(i => i.type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-gray-600">Send and manage broadcast notifications to all students in the app</p>
        </div>
        <button onClick={() => router.push("/notifications/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">
          <Plus size={18} /> New Notification
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total", value: items.length, color: "bg-gray-50 text-gray-700" },
            { label: "Published", value: publishedCount, color: "bg-green-50 text-green-700" },
            { label: "Drafts", value: draftCount, color: "bg-gray-50 text-gray-600" },
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-medium ${s.color}`}>
              {s.label}: <span className="font-bold">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search notifications..."
            className="border border-gray-300 pl-10 pr-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-64"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="all">All Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1,2,3].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="h-8 w-8 bg-gray-100 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-72" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notification</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Bell size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-medium text-gray-600">
                      {search || typeFilter !== "all" || statusFilter !== "all"
                        ? "No notifications match your filters"
                        : "No notifications yet"}
                    </p>
                    {!search && (
                      <button onClick={() => router.push("/notifications/new")}
                        className="mt-3 text-sm text-blue-600 hover:underline font-medium">
                        Create your first notification
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {typeIcon(item.type)}
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-md">{item.message}</p>
                          {item.link_url && (
                            <p className="text-[10px] text-blue-500 mt-0.5 font-mono truncate max-w-xs">{item.link_url}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${typeColor(item.type)}`}>
                        {item.type || "info"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        {item.created_at ? formatDateLong(item.created_at) : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(item.status)}`}>
                        {item.status || "draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => router.push(`/notifications/${item.id}`)} title="View"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => router.push(`/notifications/${item.id}/edit`)} title="Edit"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} title="Delete"
                          disabled={deletingId === item.id}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of{" "}
          <span className="font-semibold text-gray-800">{items.length}</span> notifications
        </p>
      )}
    </div>
  );
}
