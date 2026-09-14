"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Lock, RotateCcw, Save, ShieldCheck, Users } from "lucide-react";
import { useApi, apiPut, apiDelete } from "@/hooks/useApi";

type PermissionEntry = { id: string; label: string; description: string };
type PermissionGroup = { key: string; label: string; description: string; permissions: PermissionEntry[] };
type RouteEntry = { id: string; label: string; description: string };

type RoleRow = {
  role: string;
  label: string;
  locked: boolean;
  activeAccounts: number;
  permissions: string[];
  routes: string[];
  customised: boolean;
  updatedByName?: string;
  updatedAt?: string;
};

type RolesPayload = {
  canEdit: boolean;
  lockedRole: string;
  alwaysAllowedRoutes: string[];
  permissionGroups: PermissionGroup[];
  routeCatalog: RouteEntry[];
  roles: RoleRow[];
};

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().join("|") === [...right].sort().join("|");
}

export function RolePermissionMatrix() {
  const { data, loading, error, reload } = useApi<RolesPayload>("/api/admin/roles");

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");

  const roles = useMemo(() => data?.roles || [], [data]);
  const current = roles.find((r) => r.role === selectedRole);

  // Select the first editable role once, then follow the server on every reload so
  // the form always reflects what is actually stored.
  useEffect(() => {
    if (!roles.length) return;
    const next = roles.find((r) => r.role === selectedRole) || roles.find((r) => !r.locked) || roles[0];
    setSelectedRole(next.role);
    setPermissions(next.permissions);
    setRoutes(next.routes);
  }, [roles, selectedRole]);

  function selectRole(role: string) {
    const row = roles.find((r) => r.role === role);
    if (!row) return;
    setSelectedRole(role);
    setPermissions(row.permissions);
    setRoutes(row.routes);
    setNote("");
    setProblem("");
  }

  const dirty = Boolean(current) && (!sameSet(permissions, current!.permissions) || !sameSet(routes, current!.routes));
  const readOnly = !data?.canEdit || Boolean(current?.locked);

  function togglePermission(id: string) {
    setPermissions((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]));
    setNote("");
  }

  function toggleRoute(id: string) {
    setRoutes((list) => (list.includes(id) ? list.filter((r) => r !== id) : [...list, id]));
    setNote("");
  }

  function toggleGroup(group: PermissionGroup) {
    const ids = group.permissions.map((p) => p.id);
    const allOn = ids.every((id) => permissions.includes(id));
    setPermissions((list) => (allOn ? list.filter((p) => !ids.includes(p)) : [...new Set([...list, ...ids])]));
    setNote("");
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    setProblem("");
    try {
      await apiPut("/api/admin/roles", { role: current.role, permissions, routes });
      setNote(`${current.label} updated. Everyone with this role picks it up on their next page load.`);
      await reload();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    if (!current) return;
    if (!confirm(`Reset ${current.label} to the built-in defaults? Your customisation for this role will be discarded.`)) return;
    setSaving(true);
    setProblem("");
    try {
      await apiDelete(`/api/admin/roles?role=${encodeURIComponent(current.role)}`);
      setNote(`${current.label} is back on the built-in defaults.`);
      await reload();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <div className="rounded-lg border border-bd bg-bg1 p-6 text-sm text-t2">Loading roles…</div>;
  if (error) return <div className="rounded-lg border border-[#fecaca] bg-[#fff5f5] p-4 text-sm text-red">{error}</div>;
  if (!data || !current) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[268px_1fr]">
      {/* Role picker */}
      <div className="grid content-start gap-2">
        <div className="px-1 text-[11px] font-extrabold uppercase tracking-wide text-t2">Roles</div>
        {roles.map((row) => {
          const active = row.role === selectedRole;
          return (
            <button
              key={row.role}
              onClick={() => selectRole(row.role)}
              className={`grid gap-1 rounded-lg border px-3 py-2.5 text-left transition ${
                active ? "border-brand bg-accent" : "border-bd bg-bg1 hover:bg-bg3"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${active ? "text-brand-d" : "text-t1"}`}>{row.label}</span>
                {row.locked
                  ? <Lock size={13} className="shrink-0 text-t2" />
                  : row.customised && <span className="shrink-0 rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[10px] font-bold text-[#0369a1]">Custom</span>}
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-t2">
                <Users size={11} /> {row.activeAccounts} active {row.activeAccounts === 1 ? "account" : "accounts"}
                <span className="text-bd">•</span> {row.permissions.length} permissions
              </span>
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bd bg-bg1 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-t1">
              <ShieldCheck size={17} className="text-brand" /> {current.label}
            </h2>
            <p className="mt-0.5 text-xs text-t2">
              {current.locked
                ? "Master Admin always holds every permission and every page. This is the recovery role, so it cannot be edited."
                : current.customised
                  ? `Customised${current.updatedByName ? ` by ${current.updatedByName}` : ""}${current.updatedAt ? ` on ${new Date(current.updatedAt).toLocaleDateString()}` : ""}.`
                  : "Currently on the built-in defaults."}
            </p>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              {current.customised && (
                <button
                  onClick={resetToDefault}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:opacity-55"
                >
                  <RotateCcw size={15} /> Reset to default
                </button>
              )}
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Save size={15} /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            </div>
          )}
        </div>

        {!data.canEdit && (
          <div className="flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] text-[#92400e]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>You can review who holds what, but only a Master Admin can change it.</span>
          </div>
        )}
        {problem && <div className="rounded-lg border border-[#fecaca] bg-[#fff5f5] p-3 text-[13px] text-red">{problem}</div>}
        {note && <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[13px] text-[#15803d]">{note}</div>}

        {/* Page access */}
        <section className="rounded-lg border border-bd bg-bg1 p-4">
          <h3 className="text-sm font-extrabold text-t1">Pages this role can open</h3>
          <p className="mb-3 mt-0.5 text-xs text-t2">
            Unticked pages disappear from the menu and are blocked if visited directly. The Dashboard is always available.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.routeCatalog.map((route) => {
              const on = routes.includes(route.id);
              return (
                <label
                  key={route.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${
                    on ? "border-brand/40 bg-accent" : "border-bd bg-white"
                  } ${readOnly ? "cursor-not-allowed opacity-70" : "hover:bg-bg3"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                    checked={on}
                    disabled={readOnly}
                    onChange={() => toggleRoute(route.id)}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-[13px] font-bold text-t1">{route.label}</span>
                    <span className="text-[11px] text-t2">{route.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* Permissions */}
        {data.permissionGroups.map((group) => {
          const ids = group.permissions.map((p) => p.id);
          const onCount = ids.filter((id) => permissions.includes(id)).length;
          return (
            <section key={group.key} className="rounded-lg border border-bd bg-bg1 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-t1">{group.label}</h3>
                  <p className="mt-0.5 text-xs text-t2">{group.description}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-semibold text-t2">{onCount} of {ids.length}</span>
                  {!readOnly && (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="rounded-md border border-bd bg-white px-2.5 py-1 text-[11px] font-bold text-t1 hover:bg-bg3"
                    >
                      {onCount === ids.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((permission) => {
                  const on = permissions.includes(permission.id);
                  return (
                    <label
                      key={permission.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${
                        on ? "border-brand/40 bg-accent" : "border-bd bg-white"
                      } ${readOnly ? "cursor-not-allowed opacity-70" : "hover:bg-bg3"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                        checked={on}
                        disabled={readOnly}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span className="grid gap-0.5">
                        <span className="text-[13px] font-bold text-t1">{permission.label}</span>
                        <span className="text-[11px] text-t2">{permission.description}</span>
                        <code className="mt-0.5 w-fit rounded bg-bg3 px-1 py-px text-[10px] text-t2">{permission.id}</code>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        {dirty && !readOnly && (
          <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-lg border border-brand bg-white p-3 shadow-[var(--shadow-sm)]">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-t1">
              <Check size={15} className="text-brand" /> Unsaved changes to {current.label}
            </span>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-d disabled:opacity-55"
            >
              <Save size={15} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
