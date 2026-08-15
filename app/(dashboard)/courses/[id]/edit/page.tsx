"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import CourseWizard from "@/components/courses/CourseWizard";
import { CourseWithModules } from "@/types/course";
import { fetchCourseById } from "@/lib/supabase-course";

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseWithModules | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!courseId) return;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchCourseById(courseId);
        if (!data) {
          setNotFound(true);
        } else {
          setCourse(data);
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [courseId]);

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">Loading course...</p>
      </div>
    );
  }

  // ─── Not found state ─────────────────────────────────────────────────────────
  if (notFound || !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <span className="text-2xl">📭</span>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Course not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            This course may have been deleted or the link is incorrect.
          </p>
        </div>
        <button
          onClick={() => router.push("/courses")}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white
            rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to courses
        </button>
      </div>
    );
  }

  // ─── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/courses")}
          className="p-2 rounded-lg border border-gray-200 text-gray-500
            hover:bg-gray-100 hover:text-gray-700 transition"
          title="Back to courses"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit course</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Editing:{" "}
            <span className="font-medium text-gray-700">{course.title}</span>
          </p>
        </div>
      </div>

      {/* Wizard in edit mode — existingCourse pre-fills everything */}
      <CourseWizard existingCourse={course} />
    </div>
  );
}