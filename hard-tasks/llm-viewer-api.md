## 功能背景

开发一个 deno API server

核心功能是用户传入一个与我的 AI coder 开发需求产生的聊天记录文件（snapshot.yaml），API 解析后，渲染为 UI，生动的呈现用户输入 prompt、AI 输出不同文件代码、执行 shell 的过程。

解决的问题是让用户更好的理解我的 AI coder 的能力，以及可视化的看到一个 AI coder 开发的项目诞生的过程。

## 数据结构

snapshot.yaml 的类型如下：

```ts
type Snapshot = {
  artifacts: Artifact[];
  prd: string;
};

type Artifact = {
  id: string;
  name: string;
  actions: Action[];
};

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
```

## 用户交互

### API 交互过程

API server 运行在 8000 端口。

用户请求 `POST /visualize` 时，返回 HTML response 作为前端页面。

请求示例：

```shell
curl -X POST http://localhost:8000/visualize \
  -H "Content-Type: application/json" \
  -d '{"data":"$YOUR_SNAPSHOT_YAML"}'
```

当用户传入 data 时，解析用户 data 为 snapshot；当用户未传入 data 时，使用内部维护的 example yaml 解析并返回结果，便于用户进行体验。

API 的核心逻辑是 UI 页面的渲染，具体逻辑参考「渲染逻辑」章节。

后端使用 Deno 开发。数据不存储，无状态，response 返回后如果再次刷新，则无法查看之前的结果。

所有前端逻辑以 HTML template 的形式维护在后端 API 代码中，不使用独立的静态文件。

### 渲染逻辑

解析成功渲染后，用户看到的可视化结果是这样的：

每个 snapshot 被解析为多个 step：

- snapshot 中的 prd 字段被解析为一个 user prompt step，以聊天气泡的形式展示。
- snapshot 中所有 artifacts 的每个 action，依次被解析为一个 action step。
  - file 类型的 action step 通过代码编辑器展示。
    - 代码编辑器顶部需要展示当前编辑的文件名，实现一个类似 vscode 编辑器顶部文件 tab 的样式。
    - 代码编辑器保持只读。
  - shell 类型的 action step 通过 Terminal 风格的 UI 展示。
    - Terminal UI 保持只读。
- 根据 step 数量和当前 step，在顶部渲染一个高度 16px 的进度条，内部通过文字展示当前步骤数 / 总步骤数，已完成的进度按百分比渲染为黑色，未完成的为浅灰色。
- 进度条下方，居中展示当前 step 对应的 UI。
- 界面底部，有两个居中的上一步、下一步按钮，用 < > 来表示，用户点击后可以跳转 step。

整体 UI 风格：

- 黑白主题，现代美观。
- 需要响应式。
- 各种 UI 都应该考虑到内容可能很长，所以做好 scroll 配置
- 达到一个商业化产品的级别而不是简单的 demo。

前端页面技术栈：

- 使用原生 JS
- 使用 tailwind CSS，体现出很高的设计审美水平
- 使用 codemirror 实现代码编辑器 UI
- 使用 CDN 加载外部资源
