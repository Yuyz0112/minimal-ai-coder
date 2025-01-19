import { dirname, fromFileUrl, resolve } from "jsr:@std/path";
import { client, provider } from "../shared/llm.ts";
import { StreamingMessageParser } from "./message-parser.ts";
import { Workspace } from "../shared/workspace.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const systemPrompt = Deno.readTextFileSync(
  resolve(__dirname, "system-prompt.md")
);

async function main() {
  const workspace = new Workspace();

  const parser = new StreamingMessageParser({
    callbacks: {
      onArtifactOpen: (data) => {
        workspace.addArtifact(data.id, data.title);
      },
      onArtifactClose: (data) => {
        workspace.closeArtifact(data.id);
      },
      onActionOpen: () => {
        // not to do realtime update at this moment
      },
      onActionClose: (data) => {
        workspace.addAction(data.artifactId, data.action);
      },
    },
  });

  console.log("chat with LLM");

  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "开发一个弹球游戏，黑白颜色主题，包含记分功能" },
    ],
    model: provider.model,
  });

  for (const message of chatCompletion.choices) {
    parser.parse(`m-${message.index}`, message.message.content || "");
  }

  console.log(`App workapce: ${workspace.appRoot}. Make it happen!`);

  workspace.makeItHappen();
}

main();
