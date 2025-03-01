## 功能背景

开发一个 code sourcing CLI。

核心功能是对于一个代码库，用户指定一个代码文件内的一个 function 或一个 variable，扫描出在当前代码库中，它依赖了哪些代码，以及它被哪些代码依赖。

支持以下代码语言：

- Typescript/TSX

## 实现逻辑

### variable

例如

```ts
const x = y + 1;
```

对于 variable x，它的依赖有 y。对于 variable y，它被 x 依赖。

### function

例如

```ts
const x = 1;

function addX(y: number) {
  return y + x;
}

const z = 2;

function main() {
  console.log(addX(z));
}
```

function main 的依赖有 function addX 和 variable z、x。

我们不希望 console 这类全局变量被统计为依赖，判断是否为全局变量的方法：

- 不在当前文件中定义。
- 不在当前文件中 import。

### 唯一标识

在统计时，需要为每个 function/variable 生成一个唯一标识，避免同名等问题带来的干扰。

唯一标识的组成方式：

- filename，所在代码文件路径，代码库中唯一。对于外部依赖，则为 package name。
- scopes，所在代码文件内的 scope，例如 ["global", "outerFunction", "innerFunction"]
- variable name/function name，在 scope 内唯一。对于匿名函数，按 index 生成特殊的 function name，格式为 \_\_anonymous@$index。在我们的使用场景中，分析过程中代码都会保持不变，所以使用 index 是安全的。

唯一标识的最终格式 `$filename/$scope_1/$scope_2/.../$name`。

例如：

```ts
// filename: main.ts
function outer() {
  function inner() {
    const x = 1;
    const y = 2;

    return (() => {
      x + y;
    })();
  }
}
```

匿名箭头的唯一标识数据结构就应该是：

```ts
type Identifier = {
  filename: "main.ts";
  scopes: ["global", "outer", "inner"];
  name: "__anonymous@0";
};
```

## 用户交互

### source 命令

```shell
THE_CLI source --id $id --file $file

# --id: function/variable 唯一标识
# --file: 代码文件路径
```

输出结果分为依赖和被依赖两个 section，内容是依赖和被依赖项的唯一标识列表。

## 技术栈

使用 Deno 开发 CLI，使用 tree sitter 解析代码库。

### 在 Deno 中使用 tree sitter

在 Deno 中应该通过以下方式使用 tree sitter 的 web binding：

```ts
import { Parser, Language } from "npm:web-tree-sitter";

export function createParserFactory({ fetcher, languageWasmUrl }) {
  return {
    async initParser() {
      await Parser.init();
      const parser = new Parser();
      const response = await fetcher(languageWasmUrl);
      const bytes = await response.bytes();
      const lang = await Language.load(bytes);
      parser.setLanguage(lang);
      return parser;
    },
  };
}

const languageWasmUrl =
  "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm";

const factory = createParserFactory({
  fetcher: fetch,
  languageWasmUrl,
});

(async () => {
  const parser = await factory.initParser();
  const tree = parser.parse("const a = 123;");
})();
```

### tree sitter 各语言 wasm 文件 CDN 地址

- typescript: https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm
- TSX: https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-tsx.wasm

### 使用 tree sitter 查询 import 关系

static import:

```scheme
(
  import_statement
    source: (string) @dependency
)
```

dynamic import:

```scheme
(
  call_expression
    function: (import)
    arguments: (arguments (string) @dependency)
)
```
