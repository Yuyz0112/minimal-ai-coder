import { dirname, fromFileUrl, resolve } from "jsr:@std/path";
import { ensureDirSync } from "jsr:@std/fs";
import { stringify } from "jsr:@std/yaml";
import { BoltAction } from "../learn-from-bolts-new/message-parser.ts";

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

export type Action = FileAction | ShellAction;

export type Artifact = {
  id: string;
  name: string;
  actions: Action[];
};

export class Workspace {
  appRoot: string = Deno.makeTempDirSync({
    dir: WORKSPACE_ROOT,
  });
  artifacts: Artifact[] = [];

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

  makeItHappen() {
    Deno.writeFileSync(
      resolve(this.appRoot, `.llm.yaml`),
      new TextEncoder().encode(stringify(this.artifacts))
    );

    for (const artifact of this.artifacts) {
      console.log(`processing artifact: ${artifact.name}...`);

      for (const action of artifact.actions) {
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
              action.content
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
          default: {
            console.log(`Unknown action: ${JSON.stringify(action)}`);
          }
        }
      }
    }
  }
}
