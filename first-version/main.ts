import { dirname, fromFileUrl, resolve } from "jsr:@std/path";
import { Artifact, Workspace } from "../shared/workspace.ts";
import { parseMessageToYaml } from "../shared/yaml-parser.ts";
import { renderMarkdown } from "../shared/render-markdown.ts";
import { generateText, provider } from "../shared/ai-sdk.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const systemPrompt = renderMarkdown(
  resolve(__dirname, "./prompts/architect/system-prompt.md")
);

const prd = Deno.readTextFileSync(
  resolve(__dirname, "../hard-tasks/code-sourcing-cli.md")
);

async function architectStep() {
  const workspace = new Workspace({ name: "lab" });
  workspace.setPrd(prd);

  console.log("chat with LLM");

  const { text } = await generateText({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: renderMarkdown(
          resolve(__dirname, "./prompts/architect/user-prompt.md"),
          {
            prd,
          }
        ),
      },
    ],
    model: provider.architectModel,
  });

  const artifact = parseMessageToYaml(text) as Artifact;

  workspace.addArtifact(artifact.id, artifact.name);
  for (const action of artifact.actions) {
    workspace.addAction(artifact.id, action);
    workspace.doAction(action);
  }

  workspace.snapshot();

  console.log(`App workapce: ${workspace.appRoot}.`);
}

architectStep();
