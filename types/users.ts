export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface UserCourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  course: {
    id: string;
    title: string;
    thumbnail_url?: string;
  };
}

export interface UserProductPurchase {
  id: string;
  user_id: string;
  product_id: string;
  purchased_at: string;
  product: {
    id: string;
    name: string;
    price: number;
  };
}

export interface UserDetail extends UserProfile {
  enrollments: UserCourseEnrollment[];
  purchases: UserProductPurchase[];
}