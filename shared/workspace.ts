import { dirname, fromFileUrl, relative, resolve } from "jsr:@std/path";
import { ensureDirSync } from "jsr:@std/fs";
import { stringify, parse } from "jsr:@std/yaml";
import { collectTodos, DependencyAnalyzer, generateTree } from "./ast.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../tmp");

ensureDirSync(WORKSPACE_ROOT);

type BaseAction = {
  __reason?: string;
  content: string;
};

type FileAction = BaseAction & {
  type: "file";
  filePath: string;
};

type ShellAction = BaseAction & {
  type: "shell";
};

type StopAction = BaseAction & {
  type: "stop";
};

export type Action = FileAction | ShellAction | StopAction;

export type Artifact = {
  id: string;
  name: string;
  actions: Action[];
};

type Snapshot = {
  artifacts: Artifact[];
  prd: string;
};

type WorkspaceOptions = {
  name: string;
};

export class Workspace {
  appRoot: string;
  artifacts: Artifact[] = [];
  prd: string = "";
  analyzer: DependencyAnalyzer;

  constructor(options: WorkspaceOptions) {
    const { name } = options;
    this.appRoot = resolve(WORKSPACE_ROOT, name);
    ensureDirSync(this.appRoot);
    this.analyzer = new DependencyAnalyzer(this.appRoot);
  }

  setPrd(prd: string) {
    this.prd = prd;
  }

  addArtifact(id: string, name: string): Artifact {
    if (this.artifacts.some((artifact) => artifact.id === id)) {
      throw new Error(`Artifact with id ${id} already exists`);
    }

    const artifact = { id, name, actions: [] };
    this.artifacts.push(artifact);

    return artifact;
  }

  /**
   * @deprecated only used in early version
   */
  closeArtifact(id: string): Artifact {
    const artifact = this.artifacts.find((artifact) => artifact.id === id);

    if (!artifact) {
      throw new Error(`Artifact with id ${id} does not exist`);
    }

    return artifact;
  }

  addAction(artifactId: string, action: Action): Action {
    const artifact = this.artifacts.find(
      (artifact) => artifact.id === artifactId
    );

    if (!artifact) {
      throw new Error(`Artifact with id ${artifactId} does not exist`);
    }

    artifact.actions.push(action);

    return action;
  }

  snapshot() {
    const snapshot: Snapshot = {
      artifacts: this.artifacts,
      prd: this.prd,
    };
    Deno.writeTextFileSync(
      resolve(this.appRoot, `.llm.yaml`),
      stringify(snapshot)
    );
  }

  rebuildSnapshot() {
    const { artifacts, prd } = parse(
      Deno.readTextFileSync(resolve(this.appRoot, `.llm.yaml`))
    ) as Snapshot;

    this.artifacts = artifacts;
    this.prd = prd;
  }

  doAction(action: Action) {
    console.log(`processing a ${action.type} action...`);
    if (action.__reason) {
      console.log(
        `the LLM perform this action with reason: "${action.__reason}"`
      );
    }

    switch (action.type) {
      case "file": {
        const fileDir = resolve(this.appRoot, dirname(action.filePath));
        ensureDirSync(fileDir);

        Deno.writeTextFileSync(
          resolve(this.appRoot, action.filePath),
          // help LLM output new line
          action.content.replace(/(?<!\\)\\n/g, "\\n")
        );

        console.log(`file written to ${action.filePath}`);
        break;
      }
      case "shell": {
        const command = new Deno.Command("sh", {
          args: ["-c", action.content],
          cwd: this.appRoot,
          stdout: "inherit",
          stderr: "inherit",
        });

        const { code } = command.outputSync();

        console.log(`command exited with code: ${code}`);
        break;
      }
      case "stop": {
        throw new Error(`LLM stopped with reason: ${action.content}`);
      }
      default: {
        console.log(`Unknown action: ${JSON.stringify(action)}`);
      }
    }
  }

  async getProgress() {
    const todos = await collectTodos(this.appRoot);
    return {
      count: todos.length,
      files: todos.map((t) => `${t.filePath} (${t.todos.length})`),
    };
  }

  getDesign() {
    return Deno.readTextFileSync(resolve(this.appRoot, "design.md"));
  }

  getProjectFiles() {
    return generateTree(this.appRoot);
  }

  async getNextCodeFile() {
    const todos = await collectTodos(this.appRoot);

    if (todos.length === 0) {
      return null;
    }

    const todoSet = new Set(todos.map((t) => t.filePath));

    await this.analyzer.buildDependencyGraph();

    outer: for (const todo of todos) {
      const absolutePath = resolve(this.appRoot, todo.filePath);
      const dependencies = this.analyzer.getDependencies(absolutePath);

      for (const dep of dependencies) {
        if (todoSet.has(relative(this.appRoot, dep))) {
          continue outer;
        }
      }

      const nestedDeps = this.analyzer.getNestedDependencies(absolutePath);

      return stringify({
        filePath: todo.filePath,
        content: todo.content,
        referenceFiles: nestedDeps.map((dep) => ({
          filePath: dep,
          content: Deno.readTextFileSync(dep),
        })),
      });
    }

    throw new Error("No code file can be processed next");
  }
}
