import { dirname, fromFileUrl, resolve } from "jsr:@std/path";
import { client, provider } from "../shared/llm.ts";
import { StreamingMessageParser } from "./message-parser.ts";
import { Workspace } from "../shared/workspace.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const systemPrompt = Deno.readTextFileSync(
  resolve(__dirname, "deno-project-system-prompt.md")
);

const apiDesign = `使用 Deno 开发一个 API，
启动端口：3000

endpoints：

- GET /
  - request: none
  - response: $routes HTML
  - description：当前所有可用路由信息，以 HTML 形式输出，并且包含 a link，让用户方便跳转到对应的路由
- GET /say-hello
  - request: none
  - response: { "message": "hello" }
- GET /say-hello/:name
  - request: params: { name: string }
  - response: { "message": "hello, $name" }
- GET /count
  - request: none
  - response: { "count": $count }
  - description：当前访问 /count 次数
`;

const _cliDesign = `使用 Deno 开发一个 CLI，实现基于命令行的 Todo App：

- 数据存储在 todo.json 中
- 支持添加、删除、查看、标记完成、清空所有任务等功能
- 命令如下：
  - help，显示帮助信息
  - add <task>，添加任务
  - remove <task>，删除任务
  - list，显示所有任务
  - done <task>，标记任务完成
`;

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
      {
        role: "user",
        content: apiDesign,
      },
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
