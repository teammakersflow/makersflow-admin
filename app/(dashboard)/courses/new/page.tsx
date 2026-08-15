"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CourseWizard from "@/components/courses/CourseWizard";

export default function NewCoursePage() {
  const router = useRouter();

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
          <h1 className="text-2xl font-bold text-gray-900">Create new course</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Add course details, modules, and lessons step by step
          </p>
        </div>
      </div>

      {/* Wizard — no existingCourse prop = create mode */}
      <CourseWizard />
    </div>
  );
}