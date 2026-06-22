const SCRIPT_RE = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_RE = /\son\w+="[^"]*"/gi;

export function sanitizeHtml(html: string) {
  return html.replace(SCRIPT_RE, "").replace(EVENT_HANDLER_RE, "");
}

export function renderTemplate(input: string, data: Record<string, string | number | undefined | null>) {
  const missing = new Set<string>();
  const rendered = input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null || value === "") {
      missing.add(key);
      return "";
    }
    return String(value).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[ch] || ch));
  });
  return { rendered: sanitizeHtml(rendered), missingVariables: [...missing] };
}

export function variablesInTemplate(...parts: string[]) {
  const vars = new Set<string>();
  for (const part of parts) {
    for (const match of part.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) vars.add(match[1]);
  }
  return [...vars];
}
