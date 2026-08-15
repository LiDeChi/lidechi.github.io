# 12-Articles

`12-Articles` 是公开文章的唯一源目录，同时驱动两个阅读入口：

- Quarto / GitHub Pages：<https://lidechi.github.io/>
- 主页博客：<https://wordm.us/blog/>

## 笔记约定

`posts/` 是文章的唯一源目录，每篇文章就是一份 Obsidian 可直接编辑的 Markdown 笔记：

```text
posts/
├── 001 - 作品集不是截图墙：如何讲清一个项目的决策逻辑.md
├── 002 - 从手工报表到自动分析：让数据真正服务策划决策.md
└── 003 - 其他文章.md

assets/articles/
├── large-world-agent-system/
└── reward-functions-01/
```

文件名就是 Obsidian 中看到的笔记标题，格式统一为 `三位序号 + 空格 + 横杠 + 空格 + 标题.md`，例如 `001 - 标题.md`。序号首次按文章日期从旧到新分配，之后只递增、不重排。网页标题取 front matter 中不带序号和横杠的 `title`，稳定网址由 `article-id` 和 `output-file` 决定，因此改 Obsidian 文件名不会改网址。

图片统一存放在 `assets/articles/<article-id>/`。主题使用 `categories` 元数据，不建立“数学 / Agent / 认知科学”多层目录。草稿在文章 front matter 中设置 `draft: true`；未来日期文章必须先保持草稿状态。

## 本地预览

```bash
quarto preview
```

## 快速发布

在 Finder 或 Obsidian 文件管理器中打开 `12-Articles` 根目录，双击：

```text
发布文章.command
```

也可以在终端执行，并把文章名写进提交记录：

```bash
./发布文章.command "文章标题"
```

这个入口会依次完成：

1. 给新建且尚未编号的 Markdown 笔记追加下一个序号；
2. 检查标题、`article-id`、日期、草稿状态和文章目录约束；
3. 完整构建 Quarto 站点；
4. 只提交 `posts/` 与 `assets/articles/` 中的文章改动并推送 `main`。

若远端有新提交、当前不在 `main`、或文章目录之外还有未提交改动，脚本会停止并说明原因，不会部分发布。推送后 GitHub Actions 会自动更新 GitHub Pages，主页博客运行时读取同一份文章清单，通常 1–2 分钟内同时更新。

只想检查、不提交和推送时：

```bash
PUBLISH_DRY_RUN=1 ./发布文章.command
```

`main` 分支中的 `posts/*.md` 是文章源文件，`gh-pages` 分支只保存渲染结果。生成的 HTML、JSON 和运行文件不会写回 Obsidian 源目录。

## 主页同步

Quarto 构建会生成 `_site/articles.json`。`wordm-personal-site` 在运行时读取发布后的清单，并保留本地快照作为离线回退，因此文章正文不再手写在 React/TypeScript 中。
