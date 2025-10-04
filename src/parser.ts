export interface ArgumentSpec {
  name: string;
  options?: string[];
  default?: string;
}

const ARG_REGEX = /\{argument\s+name="([^"]+)"(?:\s+options="([^"]+)")?(?:\s+default="([^"]+)")?\}/g;
const CLIPBOARD_REGEX = /\{clipboard\}/g;
const CURSOR_REGEX = /\{cursor\}/g;

export function extractArguments(text: string): ArgumentSpec[] {
  const args: ArgumentSpec[] = [];
  const matches = text.matchAll(ARG_REGEX);

  for (const match of matches) {
    const name = match[1];
    const options = match[2]?.split(",").map((s) => s.trim());
    const defaultValue = match[3];

    args.push({
      name,
      options,
      default: defaultValue,
    });
  }

  return args;
}

export function substituteArguments(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(ARG_REGEX, (_, name) => values[name] ?? "");
}

export function substituteClipboard(text: string, clipboard: string): string {
  return text.replace(CLIPBOARD_REGEX, clipboard);
}

export function substituteCursor(text: string): { text: string; cursorIndex: number | null } {
  const token = "<<<__CURSOR__>>>";
  const replaced = text.replace(CURSOR_REGEX, token);
  const index = replaced.indexOf(token);
  const final = replaced.replace(token, "");

  return {
    text: final,
    cursorIndex: index >= 0 ? index : null,
  };
}
