const stripHtml = (source: string) =>
  source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

const escapeHtml = (source: string) =>
  source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttribute = (source: string) =>
  escapeHtml(source).replace(/`/g, "&#96;");

const isSafeUrl = (url: string) => /^(https?:|mailto:)/i.test(url.trim());

export function summarizeMarkdown(source: string, maxLength = 120) {
  const text = stripHtml(source)
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[a-z0-9_-]*\n?/gi, "").replace(/```/g, " ")
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function markdownToEditableHtml(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeFence = line.match(/^```/);
    if (codeFence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].match(/^```/)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        `<blockquote>${inlineMarkdownToHtml(quoteLines.join("\n")).replace(
          /\n/g,
          "<br>"
        )}</blockquote>`
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(
          `<li>${inlineMarkdownToHtml(
            lines[index].replace(/^\s*[-*+]\s+/, "")
          )}</li>`
        );
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(
          `<li>${inlineMarkdownToHtml(
            lines[index].replace(/^\s*\d+\.\s+/, "")
          )}</li>`
        );
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      `<p>${inlineMarkdownToHtml(paragraphLines.join("\n")).replace(
        /\n/g,
        "<br>"
      )}</p>`
    );
  }

  return blocks.join("");
}

export function editableElementToMarkdown(root: HTMLElement) {
  const blocks = Array.from(root.childNodes)
    .map((node) => blockNodeToMarkdown(node))
    .filter((block) => block.trim().length > 0);

  if (blocks.length === 0) {
    return inlineNodesToMarkdown(Array.from(root.childNodes)).trim();
  }

  return blocks.join("\n\n").trim();
}

export type MarkdownFormat =
  | "bold"
  | "italic"
  | "link"
  | "quote"
  | "bulletList"
  | "numberedList"
  | "inlineCode"
  | "codeBlock";

type ApplyMarkdownFormatInput = {
  source: string;
  selectionStart: number;
  selectionEnd: number;
  format: MarkdownFormat;
};

export function applyMarkdownFormat({
  source,
  selectionStart,
  selectionEnd,
  format,
}: ApplyMarkdownFormatInput) {
  const before = source.slice(0, selectionStart);
  const selected = source.slice(selectionStart, selectionEnd);
  const after = source.slice(selectionEnd);

  if (format === "bold") {
    return wrapSelection(before, selected || "bold text", after, "**", "**");
  }

  if (format === "italic") {
    return wrapSelection(before, selected || "italic text", after, "*", "*");
  }

  if (format === "inlineCode") {
    return wrapSelection(before, selected || "code", after, "`", "`");
  }

  if (format === "link") {
    const label = selected || "link text";
    return wrapSelection(before, label, after, "[", "](https://example.com)");
  }

  if (format === "quote") {
    return prefixLines(before, selected || "quoted text", after, "> ");
  }

  if (format === "bulletList") {
    return prefixLines(before, selected || "list item", after, "- ");
  }

  if (format === "numberedList") {
    return prefixLines(before, selected || "list item", after, "1. ");
  }

  if (format === "codeBlock") {
    return wrapSelection(
      before,
      selected || "code block",
      after,
      "```\n",
      "\n```"
    );
  }

  return {
    source,
    selectionStart,
    selectionEnd,
  };
}

const wrapSelection = (
  before: string,
  selected: string,
  after: string,
  prefix: string,
  suffix: string
) => ({
  source: `${before}${prefix}${selected}${suffix}${after}`,
  selectionStart: before.length + prefix.length,
  selectionEnd: before.length + prefix.length + selected.length,
});

const prefixLines = (
  before: string,
  selected: string,
  after: string,
  prefix: string
) => {
  const nextSelected = selected
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join("\n");

  return {
    source: `${before}${nextSelected}${after}`,
    selectionStart: before.length + prefix.length,
    selectionEnd: before.length + nextSelected.length,
  };
};

const inlineMarkdownToHtml = (source: string) => {
  const escaped = escapeHtml(source);

  return escaped
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) =>
      isSafeUrl(url)
        ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${label}</a>`
        : label
    );
};

const blockNodeToMarkdown = (node: ChildNode): string => {
  if (node.nodeType === 3) {
    return node.textContent || "";
  }

  if (node.nodeType !== 1 || !("tagName" in node)) return "";
  const element = node as HTMLElement;

  const tagName = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tagName)) {
    const level = Math.min(Number(tagName.slice(1)), 6);
    return `${"#".repeat(level)} ${inlineNodesToMarkdown(
      Array.from(element.childNodes)
    ).trim()}`;
  }

  if (tagName === "ul") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => `- ${inlineNodesToMarkdown(Array.from(child.childNodes)).trim()}`)
      .join("\n");
  }

  if (tagName === "ol") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map(
        (child, index) =>
          `${index + 1}. ${inlineNodesToMarkdown(
            Array.from(child.childNodes)
          ).trim()}`
      )
      .join("\n");
  }

  if (tagName === "blockquote") {
    return inlineNodesToMarkdown(Array.from(element.childNodes))
      .split(/\n/)
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tagName === "pre") {
    return `\`\`\`\n${element.textContent?.trimEnd() || ""}\n\`\`\``;
  }

  if (tagName === "br") return "";

  return inlineNodesToMarkdown(Array.from(element.childNodes)).trim();
};

const inlineNodesToMarkdown = (nodes: ChildNode[]): string =>
  nodes.map((node) => inlineNodeToMarkdown(node)).join("");

const inlineNodeToMarkdown = (node: ChildNode): string => {
  if (node.nodeType === 3) {
    return node.textContent || "";
  }

  if (node.nodeType !== 1 || !("tagName" in node)) return "";
  const element = node as HTMLElement;

  const tagName = element.tagName.toLowerCase();
  const content = inlineNodesToMarkdown(Array.from(element.childNodes));

  if (tagName === "strong" || tagName === "b") return `**${content}**`;
  if (tagName === "em" || tagName === "i") return `*${content}*`;
  if (tagName === "code") return `\`${element.textContent || ""}\``;
  if (tagName === "a") {
    const href = element.getAttribute("href") || "";
    return isSafeUrl(href) ? `[${content}](${href})` : content;
  }
  if (tagName === "br") return "\n";

  return content;
};
