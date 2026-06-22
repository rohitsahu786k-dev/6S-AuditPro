"use client";

import Link from "next/link";
import { UserManagementTable } from "@/components/admin/UserManagementTable";

export function AdminWorkspace() {
  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Admin</h1><p className="page-sub">Users, role-based access, masters, settings, and email administration.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/admin/email-templates">Email Templates</Link>
          <Link className="btn" href="/admin/email-logs">Email Logs</Link>
          <Link className="btn" href="/admin/email-settings">Email Settings</Link>
        </div>
      </div>
      <UserManagementTable />
    </>
  );
}
