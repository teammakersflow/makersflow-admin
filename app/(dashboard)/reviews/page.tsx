"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Star, Check, X, Trash2, MessageSquare } from "lucide-react";

// Moderation queue for course reviews submitted from the app & web.
// New/edited reviews arrive as 'pending' (enforced by a DB trigger) and are
// only visible to students once approved here.

type Review = {
  id: string;
  user_id: string;
  course_id: number;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles?: { email: string; full_name: string | null } | null;
  courses?: { title: string } | null;
};

const TABS = [
  { id: "pending", label: "Pending", color: "text-amber-600 border-amber-600" },
  { id: "approved", label: "Approved", color: "text-green-600 border-green-600" },
  { id: "rejected", label: "Rejected", color: "text-red-500 border-red-500" },
] as const;

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= n ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, ...countResults] = await Promise.all([
      supabase
        .from("reviews")
        .select("id, user_id, course_id, rating, comment, status, created_at")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200),
      ...TABS.map((t) =>
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", t.id)
      ),
    ]);

    const rows = (data ?? []) as Review[];

    // Hydrate author + course names with separate lookups (robust — avoids
    // fragile PostgREST embeds whose FK names differ across schemas).
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const courseIds = [...new Set(rows.map((r) => r.course_id).filter((v) => v != null))];

    const [{ data: profs }, { data: crs }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, email, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length
        ? supabase.from("courses").select("id, title").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const courseMap = new Map((crs ?? []).map((c: any) => [String(c.id), c]));

    setReviews(
      rows.map((r) => ({
        ...r,
        profiles: profMap.get(r.user_id) ?? null,
        courses: courseMap.get(String(r.course_id)) ?? null,
      }))
    );
    setCounts(
      Object.fromEntries(TABS.map((t, i) => [t.id, countResults[i].count ?? 0]))
    );
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: Review["status"]) {
    setBusy(id);
    const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
    setBusy(null);
    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this review?")) return;
    setBusy(id);
    await supabase.from("reviews").delete().eq("id", id);
    setBusy(null);
    load();
  }

  async function submitReply(reviewId: string) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    await supabase.from("review_replies").insert({
      review_id: reviewId, content: replyText.trim(), created_at: new Date().toISOString(),
    });
    setSubmittingReply(false);
    setReplyingTo(null);
    setReplyText("");
    alert("Reply saved. It will appear in the app when displayed.");
  }

  const visibleReviews = reviews.filter(
    (r) => ratingFilter === 0 || r.rating === ratingFilter
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
        <p className="mt-1 text-gray-600">
          Approve or reject course reviews before they become visible in the app and website
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id ? t.color : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
              {counts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <MessageSquare className="mx-auto mb-3 text-gray-300" size={40} />
          No {tab} reviews.
        </div>
      ) : (
        <>
          {/* Rating filter */}
          <div className="flex gap-2 mb-4">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRatingFilter(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  ratingFilter === n
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {n === 0 ? "All" : `${n}\u2605`}
              </button>
            ))}
          </div>

          {visibleReviews.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
              <MessageSquare className="mx-auto mb-3 text-gray-300" size={40} />
              No {tab} reviews with {ratingFilter}\u2605.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReviews.map((r) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Stars n={r.rating} />
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {r.courses?.title ?? `Course #${r.course_id}`}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{r.comment}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {r.profiles?.full_name || r.profiles?.email || r.user_id} \u00b7{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2 flex-wrap">
                      {tab !== "approved" && (
                        <button
                          onClick={() => setStatus(r.id, "approved")}
                          disabled={busy === r.id}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}
                      {tab !== "rejected" && (
                        <button
                          onClick={() => setStatus(r.id, "rejected")}
                          disabled={busy === r.id}
                          className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          <X size={14} /> Reject
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setReplyingTo(replyingTo === r.id ? null : r.id);
                          setReplyText("");
                        }}
                        className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                      >
                        \u21a9 Reply
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        disabled={busy === r.id}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {replyingTo === r.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-semibold text-blue-700">
                        Admin reply (visible in app):
                      </p>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply to this review..."
                        rows={3}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitReply(r.id)}
                          disabled={submittingReply || !replyText.trim()}
                          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {submittingReply ? "Saving..." : "Save Reply"}
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                          className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}
