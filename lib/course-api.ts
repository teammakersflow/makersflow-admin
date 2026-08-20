import { backendApi } from "@/lib/backend-api";
import { fetchCategories as fetchCategoriesApi } from "@/lib/categories-api";
import { uploadToS3 } from "@/lib/s3Upload";
import {
  CourseFormData,
  CourseWithModules,
  LessonFormData,
  ModuleFormData,
} from "@/types/course";

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

export async function fetchCategories() {
  // GET /categories — delegates to lib/categories-api.ts so there is a
  // single place that talks to the categories endpoint.
  try {
    return await fetchCategoriesApi();
  } catch (e) {
    console.warn("[course-api] fetchCategories failed:", e);
    return [];
  }
}


/**
 * CreateCourseDto / UpdateCourseDto accept ONLY these fields. The backend
 * runs ValidationPipe with `forbidNonWhitelisted: true`, so sending any
 * other key makes the whole request fail with 400.
 *
 * `gst_rate` and `hsn_code` are now accepted by the DTO and sent normally.
 * Anything else unknown is still stripped, because the backend rejects
 * unknown fields (forbidNonWhitelisted) with a 400.
 *
 * `updated_at` is managed by the database and must not be sent.
 */
const COURSE_DTO_FIELDS = new Set([
  "title", "description", "slug", "category", "thumbnail_url", "images",
  "level", "price", "is_free", "is_published", "instructor_id",
  // Added to CreateCourseDto/UpdateCourseDto by the backend.
  "gst_rate", "hsn_code",
]);

function toCourseDtoPayload(payload: Record<string, any>): Record<string, any> {
  const accepted: Record<string, any> = {};
  const dropped: string[] = [];
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined) return;
    if (COURSE_DTO_FIELDS.has(k)) accepted[k] = v;
    else dropped.push(k);
  });
  if (dropped.length > 0) {
    console.warn(
      `[courses] Not sent (backend DTO does not accept them yet): ${dropped.join(", ")}. ` +
      `See BACKEND_TODO.md — gst_rate needs adding to CreateCourseDto/UpdateCourseDto.`
    );
  }
  return accepted;
}

// ─── COURSES ──────────────────────────────────────────────────────────────────

export async function fetchCourses() {
  const { data, error } = await backendApi
    .endpoint("/courses")
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
  const { data: course, error: courseError } = await backendApi
    .endpoint("/courses")
    .select("*")
    .eq("id", id)
    .single();

  if (courseError || !course) {
    console.error("fetchCourseById error:", courseError);
    return null;
  }

  // Fetch modules
  const { data: modules, error: modulesError } = await backendApi
    .endpoint("/modules")
    .select("*")
    .eq("course_id", id)
    .order("order_index", { ascending: true });

  if (modulesError) {
    console.error("fetchModules error:", modulesError);
    return { ...course, modules: [] };
  }

  // Fetch lessons for each module
  const modulesWithLessons = await Promise.all(
    (modules || []).map(async (mod: any) => {
      const { data: lessons, error: lessonsError } = await backendApi
        .endpoint("/lessons")
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
  const { data: course, error } = await backendApi
    .endpoint("/courses")
    .insert([
      toCourseDtoPayload({
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
      }),
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
  const { data: course, error } = await backendApi
    .endpoint("/courses")
    .update(toCourseDtoPayload({
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
      // updated_at is managed by the DB; sending it would 400.
    }))
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
  const { error } = await backendApi
    .endpoint("/courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCourse error:", error);
    throw new Error(error.message);
  }
}

// ─── MODULES ──────────────────────────────────────────────────────────────────

export async function createModule(courseId: string, data: ModuleFormData) {
  const { data: module, error } = await backendApi
    .endpoint("/modules")
    .insert([
      {
        course_id: Number(courseId),
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
  const { data: module, error } = await backendApi
    .endpoint("/modules")
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
  const { error } = await backendApi
    .endpoint("/modules")
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
  const { data: lesson, error } = await backendApi
    .endpoint("/lessons")
    .insert([
      {
        module_id: Number(moduleId),
        title: data.title,
        content: data.content || null,
        video_url: data.video_url || null,
        order: data.order,
        order_index: data.order_index,
        duration_secs: data.duration_secs || null,
        notes: data.notes,
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
  const { data: lesson, error } = await backendApi
    .endpoint("/lessons")
    .update({
      title: data.title,
      content: data.content || null,
      video_url: data.video_url || null,
      order: data.order,
      order_index: data.order_index,
      duration_secs: data.duration_secs || null,
      notes: data.notes,
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
  const { error } = await backendApi
    .endpoint("/lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    console.error("deleteLesson error:", error);
    throw new Error(error.message);
  }
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

export async function uploadThumbnail(file: File): Promise<string> {
  // Was the previous backend Storage ("course-media" bucket). Now goes through the
  // backend's presigned S3 upload; see lib/s3Upload.ts for the caveats.
  return uploadToS3(file, "lessons");
}

export async function uploadVideo(file: File): Promise<string> {
  // Was the previous backend Storage ("course-assets" bucket). Same S3 path as above.
  // NOTE: presigned PUT uploads are a single request, so very large video
  // files depend on the browser holding the whole upload — there is no
  // multipart/resumable support on the backend yet.
  return uploadToS3(file, "lessons");
}
