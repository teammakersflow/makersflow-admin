"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import UsersTable from "@/features/users/components/UsersTable";
import UserDetailDrawer from "@/features/users/components/UserDetailDrawer";
import type { UserProfile } from "@/types/users";

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage students, their progress and access" />
      <UsersTable onSelectUser={setSelectedUser} />
      <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
