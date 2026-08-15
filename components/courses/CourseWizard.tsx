"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { CourseFormData, CourseWithModules, ModuleWithLessons } from "@/types/course";
import { createCourse, updateCourse } from "@/lib/course-api";
import Step1CourseDetails from "./Step1CourseDetails";
import Step2Modules from "./Step2Modules";
import Step3Lessons from "./Step3Lessons";

interface Props {
  // If provided → edit mode, otherwise → create mode
  existingCourse?: CourseWithModules;
}

const STEPS = [
  { label: "Course details", description: "Basic info & pricing" },
  { label: "Modules", description: "Organize content" },
  { label: "Lessons", description: "Add lesson content" },
];

export default function CourseWizard({ existingCourse }: Props) {
  const router = useRouter();
  const isEditMode = !!existingCourse;

  const [currentStep, setCurrentStep] = useState(1);
  const [savingStep1, setSavingStep1] = useState(false);

  // Course ID is set after step 1 create/update
  const [courseId, setCourseId] = useState<string | null>(
    existingCourse?.id || null
  );

  // Modules state — shared between step 2 and step 3
  const [modules, setModules] = useState<ModuleWithLessons[]>(
    existingCourse?.modules || []
  );

  // Initial form data for step 1
  const step1InitialData: Partial<CourseFormData> = existingCourse
    ? {
        title: existingCourse.title,
        description: existingCourse.description || "",
        slug: existingCourse.slug,
        category: existingCourse.category || "",
        thumbnail_url: existingCourse.thumbnail_url || "",
        images: Array.isArray(existingCourse.images) ? existingCourse.images : [],
        level: existingCourse.level,
        price: existingCourse.price,
        gst_rate: (existingCourse as { gst_rate?: number }).gst_rate ?? 18,
        is_free: existingCourse.is_free,
        is_published: existingCourse.is_published,
      }
    : {};

  // ─── Step 1 handler ─────────────────────────────────────────────────────────
  async function handleStep1Next(data: CourseFormData) {
    setSavingStep1(true);
    try {
      if (isEditMode && courseId) {
        await updateCourse(courseId, data);
      } else {
        const created = await createCourse(data);
        setCourseId(created.id);
      }
      setCurrentStep(2);
    } catch (err) {
      console.warn("[components/courses/CourseWizard] data error:", err);
      alert("Failed to save course. Please try again.");
    } finally {
      setSavingStep1(false);
    }
  }

  // ─── Step 2 handler ─────────────────────────────────────────────────────────
  function handleStep2Next() {
    setCurrentStep(3);
  }

  // ─── Finish ─────────────────────────────────────────────────────────────────
  function handleFinish() {
    router.push("/courses");
  }

  // ─── Step click (only allow going back to completed steps) ──────────────────
  function handleStepClick(step: number) {
    // Can't jump forward past current progress
    if (step > currentStep) return;
    // Can't go to step 2/3 without a course ID
    if (step > 1 && !courseId) return;
    setCurrentStep(step);
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center">
          {STEPS.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isActive = currentStep === stepNumber;
            const isClickable = stepNumber < currentStep || (stepNumber === 2 && courseId);

            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                {/* Step item */}
                <button
                  onClick={() => handleStepClick(stepNumber)}
                  disabled={!isClickable && !isActive}
                  className={`flex items-center gap-3 group transition
                    ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {/* Circle */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center
                      text-sm font-semibold flex-shrink-0 transition
                      ${
                        isCompleted
                          ? "bg-blue-600 text-white"
                          : isActive
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : "bg-gray-100 text-gray-400 border border-gray-200"
                      }`}
                  >
                    {isCompleted ? <Check size={16} /> : stepNumber}
                  </div>

                  {/* Labels */}
                  <div className="hidden sm:block text-left">
                    <p
                      className={`text-sm font-medium leading-none transition
                        ${isActive || isCompleted ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </button>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-3 sm:mx-4">
                    <div
                      className={`h-0.5 rounded-full transition-all duration-300
                        ${currentStep > stepNumber ? "bg-blue-600" : "bg-gray-200"}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {currentStep === 1 && (
        <Step1CourseDetails
          initialData={step1InitialData}
          onNext={handleStep1Next}
          isSubmitting={savingStep1}
        />
      )}

      {currentStep === 2 && courseId && (
        <Step2Modules
          courseId={courseId}
          modules={modules}
          onModulesChange={setModules}
          onNext={handleStep2Next}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && courseId && (
        <Step3Lessons
          courseId={courseId}
          modules={modules}
          onModulesChange={setModules}
          onFinish={handleFinish}
          onBack={() => setCurrentStep(2)}
        />
      )}
    </div>
  );
}