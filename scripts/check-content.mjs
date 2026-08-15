import {
  readFileSync,
  readdirSync,
} from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const postsRoot = join(projectRoot, "posts");
const errors = [];
const articleIds = new Set();
const articleSequences = new Set();
const numberedNotePattern = /^(\d{3}) - (.+)\.md$/u;

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function metadataFor(path) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, parseScalar(value)]),
  );
}

for (const entry of readdirSync(postsRoot, { withFileTypes: true })) {
  if (entry.name.startsWith(".") || entry.name === "_metadata.yml") continue;

  const path = join(postsRoot, entry.name);
  if (entry.isDirectory()) {
    errors.push(`posts/ 不允许出现子目录：posts/${entry.name}/`);
    continue;
  }

  if (extname(entry.name) !== ".md") {
    errors.push(`文章源文件不是 Markdown 笔记：posts/${entry.name}`);
    continue;
  }

  const filenameMatch = entry.name.match(numberedNotePattern);
  if (!filenameMatch) {
    errors.push(`文章文件名必须采用“001 - 标题.md”：posts/${entry.name}`);
  } else if (articleSequences.has(filenameMatch[1])) {
    errors.push(`文章序号重复：${filenameMatch[1]}`);
  } else {
    articleSequences.add(filenameMatch[1]);
  }

  const metadata = metadataFor(path);
  const title = metadata.title;
  if (!title) {
    errors.push(`缺少公开标题 title：posts/${entry.name}`);
  } else if (filenameMatch && title.startsWith(`${filenameMatch[1]} `)) {
    errors.push(
      `front matter 的 title 不应包含 Obsidian 序号：posts/${entry.name}`,
    );
  }

  const articleId = metadata["article-id"];
  if (!articleId) {
    errors.push(`缺少 article-id：posts/${entry.name}`);
  } else if (articleIds.has(articleId)) {
    errors.push(`article-id 重复：${articleId}`);
  } else {
    articleIds.add(articleId);
  }

  const dateSort = metadata["date-sort"] || metadata.date;
  if (dateSort && metadata.draft !== true) {
    const publishedAt = Date.parse(dateSort);
    if (Number.isFinite(publishedAt) && publishedAt > Date.now()) {
      errors.push(`未来文章没有标记为草稿：${articleId || entry.name}`);
    }
  }
}

if (!articleIds.has("large-world-agent-system")) {
  errors.push("缺少文章：large-world-agent-system");
}

if (articleIds.has("first-ai-math-article")) {
  errors.push("已删除的测试文章仍在源文件中：first-ai-math-article");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `内容检查通过：${articleIds.size} 篇带稳定序号的扁平 Markdown 笔记。`,
  );
}
