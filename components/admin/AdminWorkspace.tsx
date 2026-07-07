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
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin Management Console</h1>
          <p className="page-sub">Configure users, audit master registries, custom checklists, templates, and track system notifications.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/admin/email-templates">Email Templates</Link>
          <Link className="btn" href="/admin/email-logs">Email Logs</Link>
          <Link className="btn" href="/admin/email-settings">Email Settings</Link>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: "20px", gap: "10px" }}>
        <button 
          onClick={() => setActiveTab("users")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "users" ? "2px solid var(--brand)" : "2px solid transparent",
            color: activeTab === "users" ? "var(--text)" : "var(--muted)",
            fontWeight: activeTab === "users" ? "bold" : "normal",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          User Accounts
        </button>
        <button 
          onClick={() => setActiveTab("zones")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "zones" ? "2px solid var(--brand)" : "2px solid transparent",
            color: activeTab === "zones" ? "var(--text)" : "var(--muted)",
            fontWeight: activeTab === "zones" ? "bold" : "normal",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Workplace Zones
        </button>
        <button 
          onClick={() => setActiveTab("depts")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "depts" ? "2px solid var(--brand)" : "2px solid transparent",
            color: activeTab === "depts" ? "var(--text)" : "var(--muted)",
            fontWeight: activeTab === "depts" ? "bold" : "normal",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Departments
        </button>
        <button 
          onClick={() => setActiveTab("questions")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "questions" ? "2px solid var(--brand)" : "2px solid transparent",
            color: activeTab === "questions" ? "var(--text)" : "var(--muted)",
            fontWeight: activeTab === "questions" ? "bold" : "normal",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Checklist Questions
        </button>
        <button 
          onClick={() => setActiveTab("people")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "people" ? "2px solid var(--brand)" : "2px solid transparent",
            color: activeTab === "people" ? "var(--text)" : "var(--muted)",
            fontWeight: activeTab === "people" ? "bold" : "normal",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px"
          }}
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
