"use client";

import { useState } from "react";
import Link from "next/link";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { ZoneManagementTable } from "@/components/admin/ZoneManagementTable";
import { DepartmentManagementTable } from "@/components/admin/DepartmentManagementTable";
import { QuestionManagementTable } from "@/components/admin/QuestionManagementTable";
import { PersonManagementTable } from "@/components/admin/PersonManagementTable";

export function AdminWorkspace() {
  const [activeTab, setActiveTab] = useState<"users" | "zones" | "depts" | "questions" | "people">("users");

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Admin Management Console</h1>
          <p className="mt-1 text-sm text-t2">Configure users, audit master registries, custom checklists, templates, and track system notifications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" href="/admin/email-templates">Email Templates</Link>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" href="/admin/email-logs">Email Logs</Link>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3" href="/admin/email-settings">Email Settings</Link>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="mb-5 flex gap-2.5 overflow-x-auto border-b border-bd">
        <button
          onClick={() => setActiveTab("users")}
          className={`border-b-2 px-4 py-2 text-sm whitespace-nowrap ${activeTab === "users" ? "border-brand font-bold text-t1" : "border-transparent font-normal text-t2"}`}
        >
          User Accounts
        </button>
        <button
          onClick={() => setActiveTab("zones")}
          className={`border-b-2 px-4 py-2 text-sm whitespace-nowrap ${activeTab === "zones" ? "border-brand font-bold text-t1" : "border-transparent font-normal text-t2"}`}
        >
          Workplace Zones
        </button>
        <button
          onClick={() => setActiveTab("depts")}
          className={`border-b-2 px-4 py-2 text-sm whitespace-nowrap ${activeTab === "depts" ? "border-brand font-bold text-t1" : "border-transparent font-normal text-t2"}`}
        >
          Departments
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`border-b-2 px-4 py-2 text-sm whitespace-nowrap ${activeTab === "questions" ? "border-brand font-bold text-t1" : "border-transparent font-normal text-t2"}`}
        >
          Checklist Questions
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`border-b-2 px-4 py-2 text-sm whitespace-nowrap ${activeTab === "people" ? "border-brand font-bold text-t1" : "border-transparent font-normal text-t2"}`}
        >
          Personnel Registry
        </button>
      </div>

      {/* Render active workspace panel */}
      {activeTab === "users" && <UserManagementTable />}
      {activeTab === "zones" && <ZoneManagementTable />}
      {activeTab === "depts" && <DepartmentManagementTable />}
      {activeTab === "questions" && <QuestionManagementTable />}
      {activeTab === "people" && <PersonManagementTable />}
    </>
  );
}
