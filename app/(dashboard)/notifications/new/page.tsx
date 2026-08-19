"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { backendApi } from "@/lib/backend-api";

export default function NewNotificationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function createNotification() {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    if (!message.trim()) {
      alert("Message is required");
      return;
    }

    setLoading(true);

    const { data, error } = await backendApi
      .endpoint("/announcements")
      .insert({
        title: title.trim(),
        message: message.trim(),
        type,
        link_url: linkUrl.trim() || null,
        status,
        scheduled_at: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error(
        "[notifications] Failed to create announcement:",
        error,
      );

      alert(`Failed to send notification: ${error.message}`);
      return;
    }

    console.log(
      "[notifications] Announcement created:",
      data,
    );

    router.push("/notifications");
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/notifications")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft size={20} /> Back to Notifications
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Send New Notification</h1>
        <p className="mt-2 text-gray-600">Compose a notification that will appear in the student app</p>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 space-y-8">
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Notification Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Title <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g., New course launched"
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Message <span className="text-red-500">*</span></label>
            <textarea placeholder="Write the notification message..." rows={5}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <select className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={type} onChange={(e) => setType(e.target.value)}>
                <option value="info">Info</option>
                <option value="success">Update</option>
                <option value="warning">Alert</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Link URL <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="text" placeholder="/explore or https://..."
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Shown as a "View details" link inside the notification</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Schedule Send <span className="text-gray-400 text-xs">(optional — leave blank for immediate)</span></label>
              <input type="datetime-local"
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              {scheduledAt && <p className="text-xs text-blue-600 mt-1">Will be published at {new Date(scheduledAt).toLocaleString("en-IN")}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Publishing</h2>
          <select className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <p className="text-xs text-gray-500">
            {status === "draft" ? "Saved as draft — not visible to users." : "Published immediately — visible to every user."}
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => router.push("/notifications")}
          className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button onClick={createNotification} disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          <Save size={18} />
          {loading ? "Sending..." : "Send Notification"}
        </button>
      </div>
    </div>
  );
}
