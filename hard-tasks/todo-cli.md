使用 Deno 开发一个 CLI，实现基于命令行的 Todo App：

- 数据存储在 todo.json 中
- 支持添加、删除、查看、标记完成任务功能
- 命令如下：
  - add <task>，添加任务
  - remove <task>，删除任务
  - list，显示所有任务，格式为 \`- [ ] $task\`, 已完成则显示 \`- [x] $task\`
  - done <task>，标记任务完成
