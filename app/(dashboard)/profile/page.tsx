"use client";

import { useProfile } from "@/hooks/useProfile";
import { Mail, User, Shield, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { profile, loading } = useProfile();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-2 text-gray-600">
          View and manage your admin account information
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
              {profile?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Admin Account</h2>
              <p className="text-sm text-gray-600 mt-1">MakersFlow Administrator</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 font-medium">Loading profile...</p>
            </div>
          ) : profile ? (
            <>
              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Mail size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Email Address</p>
                  <p className="mt-2 text-lg font-medium text-gray-900">{profile.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Shield size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</p>
                  <p className="mt-2 text-lg font-medium text-gray-900 capitalize">{profile.role || "Administrator"}</p>
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <Calendar size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Member Since</p>
                  <p className="mt-2 text-lg font-medium text-gray-900">
                    {(profile as { created_at?: string }).created_at ? new Date((profile as { created_at?: string }).created_at!).toLocaleDateString() : "Recently"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 font-medium">No profile data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Tip:</span> To change your email or password, visit the Settings page.
        </p>
      </div>
    </div>
  );
}