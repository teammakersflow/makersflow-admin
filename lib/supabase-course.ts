import { supabase } from "@/lib/supabase";
import {
  CourseFormData,
  CourseWithModules,
  LessonFormData,
  ModuleFormData,
} from "@/types/course";

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchCategories error:", error);
    return [];
  }

  return data || [];
}

// ─── COURSES ──────────────────────────────────────────────────────────────────

export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchCourses error:", error);
    return [];
  }

  return data || [];
}

export async function fetchCourseById(
  id: string
): Promise<CourseWithModules | null> {
  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (courseError || !course) {
    console.error("fetchCourseById error:", courseError);
    return null;
  }

  // Fetch modules
  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", id)
    .order("order_index", { ascending: true });

  if (modulesError) {
    console.error("fetchModules error:", modulesError);
    return { ...course, modules: [] };
  }

  // Fetch lessons for each module
  const modulesWithLessons = await Promise.all(
    (modules || []).map(async (mod) => {
      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("*")
        .eq("module_id", mod.id)
        .order("order_index", { ascending: true });

      if (lessonsError) {
        console.error("fetchLessons error:", lessonsError);
        return { ...mod, lessons: [] };
      }

      return { ...mod, lessons: lessons || [] };
    })
  );

  return { ...course, modules: modulesWithLessons };
}

export async function createCourse(data: CourseFormData) {
  const { data: course, error } = await supabase
    .from("courses")
    .insert([
      {
        title: data.title,
        description: data.description || null,
        slug: data.slug,
        category: data.category || null,
        thumbnail_url: data.thumbnail_url || null,
        images: data.images ?? [],
        level: data.level.toLowerCase(),
        price: data.is_free ? 0 : data.price,
        gst_rate: data.gst_rate ?? 18,
        is_free: data.is_free,
        is_published: data.is_published,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("createCourse error:", error);
    throw new Error(error.message);
  }

  return course;
}

export async function updateCourse(id: string, data: Partial<CourseFormData>) {
  const { data: course, error } = await supabase
    .from("courses")
    .update({
      title: data.title,
      description: data.description || null,
      slug: data.slug,
      category: data.category || null,
      thumbnail_url: data.thumbnail_url || null,
      images: data.images ?? [],
      level: data.level,
      price: data.is_free ? 0 : data.price,
      gst_rate: data.gst_rate ?? 18,
      is_free: data.is_free,
      is_published: data.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateCourse error:", error);
    throw new Error(error.message);
  }

  return course;
}

export async function deleteCourse(id: string) {
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCourse error:", error);
    throw new Error(error.message);
  }
}

// ─── MODULES ──────────────────────────────────────────────────────────────────

export async function createModule(courseId: string, data: ModuleFormData) {
  const { data: module, error } = await supabase
    .from("modules")
    .insert([
      {
        course_id: courseId,
        title: data.title,
        order: data.order,
        order_index: data.order_index,
        duration_mins: data.duration_mins || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("createModule error:", error);
    throw new Error(error.message);
  }

  return module;
}

export async function updateModule(
  moduleId: string,
  data: Partial<ModuleFormData>
) {
  const { data: module, error } = await supabase
    .from("modules")
    .update({
      title: data.title,
      order: data.order,
      order_index: data.order_index,
      duration_mins: data.duration_mins || null,
    })
    .eq("id", moduleId)
    .select()
    .single();

  if (error) {
    console.error("updateModule error:", error);
    throw new Error(error.message);
  }

  return module;
}

export async function deleteModule(moduleId: string) {
  const { error } = await supabase
    .from("modules")
    .delete()
    .eq("id", moduleId);

  if (error) {
    console.error("deleteModule error:", error);
    throw new Error(error.message);
  }
}

// ─── LESSONS ──────────────────────────────────────────────────────────────────

export async function createLesson(
  moduleId: string,
  data: LessonFormData
) {
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert([
      {
        module_id: moduleId,
        title: data.title,
        content: data.content || null,
        video_url: data.video_url || null,
        order: data.order,
        order_index: data.order_index,
        duration_secs: data.duration_secs || null,
        notes: data.notes || null,
        is_preview: data.is_preview,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("createLesson error:", error);
    throw new Error(error.message);
  }

  return lesson;
}

export async function updateLesson(
  lessonId: string,
  data: Partial<LessonFormData>
) {
  const { data: lesson, error } = await supabase
    .from("lessons")
    .update({
      title: data.title,
      content: data.content || null,
      video_url: data.video_url || null,
      order: data.order,
      order_index: data.order_index,
      duration_secs: data.duration_secs || null,
      notes: data.notes || null,
      is_preview: data.is_preview,
    })
    .eq("id", lessonId)
    .select()
    .single();

  if (error) {
    console.error("updateLesson error:", error);
    throw new Error(error.message);
  }

  return lesson;
}

export async function deleteLesson(lessonId: string) {
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    console.error("deleteLesson error:", error);
    throw new Error(error.message);
  }
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

export async function uploadThumbnail(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `thumbnails/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("course-media")
    .upload(fileName, file, { upsert: true });

  if (error) {
    console.error("uploadThumbnail error:", error);
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from("course-media")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function uploadVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `videos/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("course-assets")
    .upload(fileName, file, { upsert: true });

  if (error) {
    console.error("uploadVideo error:", error);
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from("course-assets")
    .getPublicUrl(fileName);

  return data.publicUrl;
}