import { resolve, dirname } from "jsr:@std/path";

export function renderMarkdown(
  filePath: string,
  variables: Record<string, string> = {}
): string {
  const templateContent = Deno.readTextFileSync(filePath);

  const renderedContent = replaceIncludes(templateContent, filePath, variables);

  return renderedContent;
}

function replaceIncludes(
  content: string,
  currentFilePath: string,
  variables: Record<string, string>
): string {
  const includeRegex = /\{\{\s*@include\s+(.+?)\s*\}\}/g;
  const variableRegex = /\{\{\s*@variable\s+(\w+)\s*\}\}/g;

  content = content.replace(includeRegex, (_, includePath: string) => {
    includePath = includePath.replace(/['"]+/g, "");

    const baseDir = dirname(currentFilePath);
    const includeFilePath = resolve(baseDir, includePath);

    try {
      const includedContent = Deno.readTextFileSync(includeFilePath);

      return replaceIncludes(includedContent, includeFilePath, variables);
    } catch (error) {
      throw new Error(`Error including file: ${includeFilePath}: ` + error);
    }
  });

  content = content.replace(variableRegex, (_, variableName: string) => {
    if (variableName in variables) {
      return variables[variableName];
    } else {
      throw new Error(`Undefined variable: ${variableName}`);
    }
  });

  return content;
}
