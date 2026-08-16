"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { backendApi } from "@/lib/backend-api";
import { Search, Edit2, Trash2, Eye, BookOpen, Users, Plus, Copy } from "lucide-react";
import { deleteFromS3, extractS3Key } from "@/lib/s3Upload";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type Course = {
  id: string;
  title: string;
  category: string;
  level: string;
  price: number;
  is_free: boolean;
  is_published: boolean;
  created_at: string;
  thumbnail_url?: string | null;
};

export default function CoursesPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"published"|"draft">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      setLoading(true);
      const { data, error } = await backendApi
        .endpoint("/courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
      } else {
        setCourses(data || []);
      }
      setLoading(false);
    }

    loadCourses();
  }, []);

  const handleView = (id: string) => {
    router.push(`/courses/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/courses/${id}/edit`);
  };

const handleDelete = async (id: string) => {
  const confirmed = confirm(
    "Are you sure you want to delete this course? All modules and lessons will also be deleted. This cannot be undone."
  );
  if (!confirmed) return;

  setDeletingId(id);

  try {
    // fetch all media URLs before deleting — thumbnail + all lesson videos
    const { data: courseData } = await backendApi
      .endpoint("/courses")
      .select(`
        thumbnail_url,
        modules (
          lessons ( video_url )
        )
      `)
      .eq("id", id)
      .single();

    // delete the course — cascade deletes modules and lessons automatically
    const { error } = await backendApi.endpoint("/courses").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      alert("Failed to delete course. Please try again.");
      setDeletingId(null);
      return;
    }

    // update UI immediately
    setCourses((prev) => prev.filter((c) => c.id !== id));

    // clean up S3 files in the background
    if (courseData) {
      // delete thumbnail
      if (courseData.thumbnail_url?.includes('amazonaws.com')) {
        const key = extractS3Key(courseData.thumbnail_url, 'courses');
        if (key) await deleteFromS3(key);
      }

      // delete all lesson videos
      const lessons = courseData.modules?.flatMap((m: any) => m.lessons || []) || [];
      for (const lesson of lessons) {
        if (lesson.video_url?.includes('amazonaws.com')) {
          const key = extractS3Key(lesson.video_url, 'courses');
          if (key) await deleteFromS3(key);
        }
      }
    }
  } catch (err) {
    console.warn("[courses] data error:", err);
  } finally {
    setDeletingId(null);
  }
};

  const uniqueCategories = [...new Set(courses.map(c => c.category).filter(Boolean))];
  const uniqueLevels = [...new Set(courses.map(c => c.level).filter(Boolean))];

  const filteredCourses = courses.filter(course => {
    if (search && !course.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "published" && !course.is_published) return false;
    if (statusFilter === "draft" && course.is_published) return false;
    if (categoryFilter !== "all" && course.category !== categoryFilter) return false;
    if (levelFilter !== "all" && course.level !== levelFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkPublish = async (publish: boolean) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${publish ? "Publish" : "Unpublish"} ${selectedIds.size} courses?`)) return;
    const ids = [...selectedIds];
    const { error } = await backendApi.endpoint("/courses").update({ is_published: publish }).in("id", ids);
    if (!error) {
      setCourses(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, is_published: publish } : c));
      setSelectedIds(new Set());
    }
  };

  const duplicateCourse = async (course: Course) => {
    if (!confirm(`Duplicate "${course.title}"? A copy will be created as a Draft.`)) return;
    const { data, error } = await backendApi.endpoint("/courses").insert({
      title: `Copy of ${course.title}`,
      category: course.category, level: course.level,
      price: course.price, is_free: course.is_free,
      is_published: false, thumbnail_url: course.thumbnail_url,
    }).select().single();
    if (!error && data) setCourses(prev => [data as Course, ...prev]);
    else if (error) alert(error.message);
  };

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (published: boolean) =>
    published ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-blue-900">{selectedIds.size} selected</span>
          <button onClick={() => bulkPublish(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 transition">Publish All</button>
          <button onClick={() => bulkPublish(false)} className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-700 transition">Unpublish All</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-blue-500 text-sm ml-auto hover:text-blue-700">Clear</button>
        </div>
      )}

      <PageHeader title="Courses" description={`${courses.length} total · ${courses.filter(c => c.is_published).length} published`}
        action={{ label: "New Course", href: "/courses/new" }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-56" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          {uniqueCategories.length > 0 && (
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {uniqueLevels.length > 0 && (
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
              <option value="all">All Levels</option>
              {uniqueLevels.map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
            </select>
          )}
        </div>
      </PageHeader>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Loading skeleton */}
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-6 bg-gray-200 rounded-full w-20" />
                <div className="h-4 bg-gray-200 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Course Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Level
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Price
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                        <BookOpen size={24} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          {search ? "No courses match your search" : "No courses yet"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {!search
                            ? "Click 'Add Course' to create your first course"
                            : "Try a different search term"}
                        </p>
                      </div>
                      {!search && (
                        <button
                          onClick={() => router.push("/courses/new")}
                          className="flex items-center gap-1.5 text-sm text-blue-600
                            hover:text-blue-700 font-medium transition mt-1"
                        >
                          <Plus size={14} />
                          Create first course
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-gray-50 transition group"
                  >
                    {/* Title + thumbnail */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="h-10 w-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <BookOpen size={16} className="text-gray-400" />
                          </div>
                        )}
                        <p className="font-medium text-gray-900 text-sm">
                          {course.title}
                        </p>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {course.category || "—"}
                    </td>

                    {/* Level */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium
                          ${getLevelColor(course.level)}`}
                      >
                        {course.level
                          ? course.level.charAt(0).toUpperCase() +
                            course.level.slice(1)
                          : "—"}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4 text-sm">
                      {course.is_free ? (
                        <span className="text-green-600 font-semibold">Free</span>
                      ) : (
                        <span className="text-gray-900 font-medium">
                          ₹{course.price}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium
                          ${getStatusColor(course.is_published)}`}
                      >
                        {course.is_published ? "Published" : "Draft"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <input type="checkbox" checked={selectedIds.has(course.id)}
                          onChange={() => toggleSelect(course.id)}
                          className="w-3.5 h-3.5 accent-blue-600 rounded mr-1" />
                        <button onClick={() => handleView(course.id)} title="View course"
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => handleEdit(course.id)} title="Edit course"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => duplicateCourse(course)} title="Duplicate course"
                          className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleDelete(course.id)} title="Delete course"
                          disabled={deletingId === course.id}
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

      {/* Footer count */}
      {!loading && filteredCourses.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-800">
            {filteredCourses.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-gray-800">{courses.length}</span>{" "}
          courses
        </p>
      )}
    </div>
  );
}