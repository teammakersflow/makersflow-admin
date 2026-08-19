export type Course = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  category: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  instructor_id: string | null;
  level: "Beginner" | "Intermediate" | "Advanced";
  price: number;
  is_free: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  order: number;
  order_index: number;
  duration_mins: number | null;
  created_at: string;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  order: number;
  order_index: number;
  duration_secs: number | null;
  notes: string[] | null;
  is_preview: boolean;
  created_at: string;
};

export type ModuleWithLessons = Module & {
  lessons: Lesson[];
};

export type CourseWithModules = Course & {
  modules: ModuleWithLessons[];
};

// ─── Form types ───────────────────────────────────────────────────────────────

export type CourseFormData = {
  title: string;
  description: string;
  slug: string;
  category: string;
  thumbnail_url: string;
  images: string[];
  level: "Beginner" | "Intermediate" | "Advanced";
  price: string | number;
  gst_rate: number;
  is_free: boolean;
  is_published: boolean;
};

export type ModuleFormData = {
  title: string;
  order: number;
  order_index: number;
  duration_mins: number;
};

export type LessonFormData = {
  title: string;
  content: string;
  video_url: string;
  order: number;
  order_index: number;
  duration_secs: number;
  notes: string[];
  is_preview: boolean;
};