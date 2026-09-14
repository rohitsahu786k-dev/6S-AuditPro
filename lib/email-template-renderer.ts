import sanitize from "sanitize-html";

export function sanitizeHtml(html: string) {
  return sanitize(html, {
    allowedTags: [...sanitize.defaults.allowedTags, "img", "html", "head", "body", "meta", "title"],
    allowedAttributes: {
      "*": ["style", "class", "id", "align", "valign", "width", "height", "bgcolor", "role"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      table: ["cellpadding", "cellspacing", "border", "width", "role", "style"],
      td: ["colspan", "rowspan", "align", "valign", "style", "width", "height", "bgcolor"]
    },
    allowedSchemes: ["https", "http", "mailto", "cid"],
    allowProtocolRelative: false
  });
}

export function renderTemplate(input: string, data: Record<string, string | number | undefined | null>, mode: "html" | "text" = "html") {
  const missing = new Set<string>();
  const rendered = input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null || value === "") {
      missing.add(key);
      return "";
    }
    return mode === "text" ? String(value) : String(value).replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;" }[ch] || ch));
  });
  return { rendered: mode === "html" ? sanitizeHtml(rendered) : rendered, missingVariables: [...missing] };
}

export function variablesInTemplate(...parts: string[]) {
  const vars = new Set<string>();
  for (const part of parts) {
    for (const match of part.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) vars.add(match[1]);
  }
  return [...vars];
}
