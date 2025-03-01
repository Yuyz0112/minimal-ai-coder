import { Parser, Language, Query, Node } from "npm:web-tree-sitter";
import { dirname, resolve, join, extname, relative } from "jsr:@std/path";

await Parser.init();

const parser = new Parser();
const langMap: Record<string, string> = {
  ".ts":
    "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm",
  ".tsx":
    "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-tsx.wasm",
};

const TODO_MARK = `// TODO(ai-coder)`;

type Todo = {
  todoComment: string;
};

function traverseCode(node: Node, todos: Todo[] = []) {
  if (node.type === "comment" && node.text.includes(TODO_MARK)) {
    const todoComment = node.text.trim();

    todos.push({
      todoComment,
    });
  }

  for (const child of node.children) {
    if (child) {
      traverseCode(child, todos);
    }
  }

  return todos;
}

async function traverseWorkspace(
  parent: string,
  files: { path: string; content: string }[] = []
) {
  for await (const entry of Deno.readDir(parent)) {
    if (entry.isDirectory) {
      files.push(...(await traverseWorkspace(join(parent, entry.name))));
    } else {
      files.push({
        path: join(parent, entry.name),
        content: Deno.readTextFileSync(join(parent, entry.name)),
      });
    }
  }

  return files;
}

type TodosPerFile = {
  filePath: string;
  todos: Todo[];
  content: string;
};

export async function collectTodos(appRoot: string) {
  const allTodos: TodosPerFile[] = [];

  for (const file of await traverseWorkspace(appRoot)) {
    const ext = extname(file.path);

    if (!langMap[ext]) {
      continue;
    }

    const Lang = await Language.load(
      await fetch(langMap[ext]).then((res) => res.bytes())
    );
    parser.setLanguage(Lang);

    const tree = parser.parse(file.content)!;

    const todos = traverseCode(tree.rootNode);

    if (todos.length) {
      allTodos.push({
        filePath: relative(appRoot, file.path),
        todos,
        content: file.content,
      });
    }
  }

  return allTodos;
}

export async function generateTree(
  dirPath: string,
  prefix: string = ""
): Promise<string> {
  let output = "";

  const entries = [];
  for await (const entry of Deno.readDir(dirPath)) {
    entries.push(entry);
  }

  const sortedEntries = entries.sort(
    (a, b) =>
      Number(b.isDirectory) - Number(a.isDirectory) ||
      a.name.localeCompare(b.name)
  );

  const totalEntries = sortedEntries.length;

  for (let i = 0; i < totalEntries; i++) {
    const entry = sortedEntries[i];
    const isLast = i === totalEntries - 1;
    const connector = isLast ? "└── " : "├── ";
    const nextPrefix = isLast ? "    " : "│   ";

    output += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory) {
      const subDirPath = join(dirPath, entry.name);
      output += await generateTree(subDirPath, prefix + nextPrefix);
    }
  }

  return output;
}

type DependencyGraph = {
  dependencies: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
};

export class DependencyAnalyzer {
  graph: DependencyGraph = {
    dependencies: new Map(),
    dependents: new Map(),
  };

  constructor(private appRoot: string) {}

  async buildDependencyGraph() {
    const files = await traverseWorkspace(this.appRoot);
    const fileSet = new Set(files.map((file) => file.path));

    for (const file of files) {
      // init data structure
      this.graph.dependencies.set(file.path, new Set());
      this.graph.dependents.set(file.path, new Set());
    }

    for (const file of files) {
      const ext = extname(file.path);

      if (!langMap[ext]) {
        continue;
      }

      const Lang = await Language.load(
        await fetch(langMap[ext]).then((res) => res.bytes())
      );
      parser.setLanguage(Lang);

      const importQuery = new Query(
        Lang,
        `
        (import_statement
          source: (string) @import_source)

        (export_statement
          source: (string) @export_source)

        (call_expression
          function: (identifier) @import_func
          arguments: (arguments (string) @dynamic_source)
          (#eq? @import_func "require"))
        
        (call_expression
          function: (import)
          arguments: (arguments (string) @dynamic_source))
      `
      );

      const tree = parser.parse(file.content)!;
      const imports = new Set<string>();

      for (const match of importQuery.matches(tree.rootNode)) {
        let source: string | null = null;

        for (const capture of match.captures) {
          if (capture.name.endsWith("_source")) {
            source = capture.node.text.slice(1, -1);
            break;
          }
        }

        if (source) {
          imports.add(source);
        }
      }

      for (const specifier of imports) {
        const resolved = this.resolveImport(file.path, specifier, fileSet);
        if (resolved) {
          this.graph.dependencies.get(file.path)!.add(resolved);
          this.graph.dependents.get(resolved)!.add(file.path);
        }
      }
    }

    return this.graph;
  }

  getDependencies(file: string): string[] {
    return Array.from(this.graph.dependencies.get(file) || []);
  }

  getNestedDependencies(file: string): string[] {
    const deps = this.getDependencies(file);
    const nestedDeps = deps.flatMap((dep) => [
      dep,
      ...this.getNestedDependencies(dep),
    ]);

    return Array.from(new Set(nestedDeps));
  }

  getDependents(file: string): string[] {
    return Array.from(this.graph.dependents.get(file) || []);
  }

  private resolveImport(
    importer: string,
    specifier: string,
    fileSet: Set<string>
  ): string | null {
    if (specifier.startsWith(".")) {
      const baseDir = dirname(importer);
      const absolutePath = this.resolveRelativeSpecifier(baseDir, specifier);
      return this.findExistingFile(absolutePath, fileSet);
    }

    if (specifier.startsWith("/")) {
      const absolutePath = join(this.appRoot, specifier);
      return this.findExistingFile(absolutePath, fileSet);
    }

    return null;
  }

  private resolveRelativeSpecifier(baseDir: string, specifier: string): string {
    const normalized = resolve(baseDir, specifier);
    return normalized.startsWith(this.appRoot)
      ? normalized
      : join(this.appRoot, normalized);
  }

  private findExistingFile(
    basePath: string,
    fileSet: Set<string>
  ): string | null {
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      join(basePath, "index.ts"),
      join(basePath, "index.tsx"),
    ];

    for (const candidate of candidates) {
      if (fileSet.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }
}
