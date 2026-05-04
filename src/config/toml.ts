type TomlScalar = string | number | boolean;
type TomlValue = TomlScalar | TomlScalar[] | TomlObject;
export type TomlObject = { [key: string]: TomlValue };

export function parseToml(text: string): TomlObject {
  const root: TomlObject = {};
  let current: TomlObject = root;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      current = ensurePath(root, tableMatch[1].split("."));
      continue;
    }

    const equalAt = line.indexOf("=");
    if (equalAt === -1) continue;
    const key = line.slice(0, equalAt).trim();
    const value = line.slice(equalAt + 1).trim();
    current[key] = parseValue(value);
  }

  return root;
}

export function stringifyToml(value: TomlObject): string {
  const lines: string[] = [];
  const tables: Array<[string, TomlObject]> = [];

  for (const [key, item] of Object.entries(value)) {
    if (isObject(item)) tables.push([key, item]);
    else lines.push(`${key} = ${formatValue(item)}`);
  }

  for (const [key, table] of tables) {
    appendTable(lines, key, table);
  }

  return `${lines.join("\n")}\n`;
}

function appendTable(lines: string[], prefix: string, table: TomlObject): void {
  const scalars: string[] = [];
  const children: Array<[string, TomlObject]> = [];
  for (const [key, value] of Object.entries(table)) {
    if (isObject(value)) children.push([key, value]);
    else scalars.push(`${key} = ${formatValue(value)}`);
  }
  if (scalars.length) {
    if (lines.length) lines.push("");
    lines.push(`[${prefix}]`, ...scalars);
  }
  for (const [key, child] of children) appendTable(lines, `${prefix}.${key}`, child);
}

function stripComment(line: string): string {
  let quoted = false;
  let escaped = false;
  let arrayDepth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "[") arrayDepth += 1;
    if (!quoted && char === "]" && arrayDepth > 0) arrayDepth -= 1;
    if (char === "#" && !quoted && arrayDepth === 0) return line.slice(0, i);
  }
  return line;
}

function parseValue(value: string): TomlScalar | TomlScalar[] {
  if (value.startsWith("[") && value.endsWith("]")) return parseArray(value);
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value === "true") return true;
  if (value === "false") return false;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function parseArray(value: string): TomlScalar[] {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return splitArrayItems(inner).map((item) => parseValue(item.trim()) as TomlScalar);
}

function splitArrayItems(value: string): string[] {
  const items: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      items.push(value.slice(start, i));
      start = i + 1;
    }
  }
  items.push(value.slice(start));
  return items.filter((item) => item.trim().length > 0);
}

function formatValue(value: TomlScalar | TomlScalar[]): string {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function ensurePath(root: TomlObject, pathParts: string[]): TomlObject {
  let current = root;
  for (const part of pathParts) {
    if (!isObject(current[part])) current[part] = {};
    current = current[part] as TomlObject;
  }
  return current;
}

function isObject(value: unknown): value is TomlObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
