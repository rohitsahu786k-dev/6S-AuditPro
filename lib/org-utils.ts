const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function splitEmailList(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw
    .split(/[,\n;]/)
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, list) => EMAIL_RE.test(email) && list.indexOf(email) === index);
}

function compactDepartment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function departmentStem(value: string) {
  return compactDepartment(value).replace(/s$/, "");
}

export function canonicalDepartmentName(name: string | undefined, configuredDepartments: string[]) {
  if (!name) return "";
  const trimmed = name.trim();
  const exact = configuredDepartments.find((dept) => dept.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const compactName = compactDepartment(trimmed);
  const stemName = departmentStem(trimmed);
  const alias = configuredDepartments.find((dept) => {
    const compactDept = compactDepartment(dept);
    const stemDept = departmentStem(dept);
    return compactDept === compactName || compactDept.endsWith(compactName) || compactName.endsWith(compactDept) || stemDept.endsWith(stemName) || stemName.endsWith(stemDept);
  });
  return alias || trimmed;
}
