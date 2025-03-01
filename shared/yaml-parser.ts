import { parse } from "jsr:@std/yaml";

export function parseMessageToYaml(input: string) {
  // Regular expression to match JSON code blocks
  const codeBlockRegex = /```yaml\n([\s\S]*?)\n```/g;

  // Find all matches for JSON code blocks
  const matches = Array.from(input.matchAll(codeBlockRegex));

  if (matches.length > 1) {
    throw new Error("Multiple JSON code blocks found in the input string.");
  }

  let codeStr: string;

  if (matches.length === 1) {
    codeStr = matches[0][1].trim();
  } else {
    codeStr = input.trim();
  }

  try {
    return parse(codeStr);
  } catch (error) {
    throw new Error(
      "Failed to parse: " + error + "\n\n======\n\n" + codeStr + "\n\n======"
    );
  }
}
