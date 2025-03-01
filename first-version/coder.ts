import { dirname, fromFileUrl, resolve } from "jsr:@std/path";
import { generateText, provider } from "../shared/ai-sdk.ts";
import { Action, Workspace } from "../shared/workspace.ts";
import { renderMarkdown } from "../shared/render-markdown.ts";
import { parseMessageToYaml } from "../shared/yaml-parser.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const systemPrompt = renderMarkdown(
  resolve(__dirname, "./prompts/coder/system-prompt.md")
);

async function coderStep() {
  const workspace = new Workspace({
    name: "lab",
  });

  workspace.rebuildSnapshot();

  while (true) {
    console.log("chat with LLM");

    const nextCodeFile = await workspace.getNextCodeFile();
    if (!nextCodeFile) {
      break;
    }

    const userPrompt = renderMarkdown(
      resolve(__dirname, "./prompts/coder/user-prompt.md"),
      {
        prd: workspace.prd,
        design: workspace.getDesign(),
        codeFile: nextCodeFile,
      }
    );

    const { text } = await generateText({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model: provider.coderModel,
    });

    const { actions } = parseMessageToYaml(text) as {
      actions: Action[];
    };

    console.log(actions);

    for (const action of actions) {
      workspace.addAction(workspace.artifacts[0].id, action);
      workspace.doAction(action);
    }

    workspace.snapshot();

    const progress = await workspace.getProgress();
    if (progress.count === 0) {
      console.log("all done!");
      break;
    } else {
      console.log(`还有 ${progress.count} 个 file 未完成`);
      console.log(progress.files);
    }
  }
}

coderStep();
