"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

export default function EditNotificationPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", message: "", type: "info", link_url: "", status: "draft",
  });

  useEffect(() => {
    fetch(`/api/announcements/${id}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setForm({
          title: data.title || "",
          message: data.message || "",
          type: data.type || "info",
          link_url: data.link_url || "",
          status: data.status || "draft",
        });
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    if (!form.message.trim()) { alert("Message is required."); return; }
    setSaving(true);

    const res = await fetch(`/api/announcements/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, link_url: form.link_url || null }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) { alert(json.error || "Failed to save."); return; }
    router.push("/notifications");
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => router.push("/notifications")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft size={18} /> Back to Notifications
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Notification</h1>
        <p className="mt-1 text-gray-600">Update this notification</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Title <span className="text-red-500">*</span></label>
          <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
            <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="info">Info</option>
              <option value="success">Update</option>
              <option value="warning">Alert</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
            <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Link URL <span className="text-gray-400 text-xs">(optional)</span></label>
          <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })}
            placeholder="/explore or https://..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Message <span className="text-red-500">*</span></label>
          <textarea rows={8} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <button onClick={() => router.push("/notifications")}
            className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
