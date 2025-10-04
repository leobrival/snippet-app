import { invoke } from "@tauri-apps/api/core";
import { substituteArguments, substituteClipboard, substituteCursor } from "./parser";

export async function executeSnippet(
  text: string,
  argumentValues: Record<string, string>
): Promise<{ result: string; cursorIndex: number | null }> {
  // Step 1: Replace {argument} placeholders
  let result = substituteArguments(text, argumentValues);

  // Step 2: Replace {clipboard} placeholder
  const clipboardContent = await invoke<string>("read_clipboard").catch(() => "");
  result = substituteClipboard(result, clipboardContent);

  // Step 3: Handle {cursor} placeholder
  const { text: finalText, cursorIndex } = substituteCursor(result);

  return {
    result: finalText,
    cursorIndex,
  };
}

export async function copyToClipboard(text: string): Promise<void> {
  await invoke("write_clipboard", { text });
}
