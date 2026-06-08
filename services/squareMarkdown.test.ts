import { describe, expect, it } from "vitest";
import {
  applyMarkdownFormat,
  editableElementToMarkdown,
  markdownToEditableHtml,
  summarizeMarkdown,
} from "./squareMarkdown";

describe("Square Markdown summaries", () => {
  it("turns Markdown source into readable feed and notification excerpts", () => {
    expect(
      summarizeMarkdown(
        "# Recruitment\n\nSee **Keeper notes** at [the doc](https://example.com).\n\n`1d100` <script>bad()</script>",
        48
      )
    ).toBe("Recruitment See Keeper notes at the doc. 1d100");
  });

  it("uses image alt text in excerpts without exposing image markup", () => {
    expect(
      summarizeMarkdown("Before ![Keeper map](https://example.com/map.png) after")
    ).toBe("Before Keeper map after");
  });
});

describe("Square Markdown editor formatting", () => {
  it("wraps the selected source text with Markdown syntax", () => {
    expect(
      applyMarkdownFormat({
        source: "Keeper notes",
        selectionStart: 0,
        selectionEnd: 6,
        format: "bold",
      })
    ).toEqual({
      source: "**Keeper** notes",
      selectionStart: 2,
      selectionEnd: 8,
    });
  });

  it("inserts common forum Markdown for empty selections", () => {
    expect(
      applyMarkdownFormat({
        source: "",
        selectionStart: 0,
        selectionEnd: 0,
        format: "link",
      }).source
    ).toBe("[link text](https://example.com)");

    expect(
      applyMarkdownFormat({
        source: "Clue",
        selectionStart: 0,
        selectionEnd: 4,
        format: "quote",
      }).source
    ).toBe("> Clue");

    expect(
      applyMarkdownFormat({
        source: "spot hidden",
        selectionStart: 0,
        selectionEnd: 11,
        format: "bulletList",
      }).source
    ).toBe("- spot hidden");

    expect(
      applyMarkdownFormat({
        source: "",
        selectionStart: 0,
        selectionEnd: 0,
        format: "codeBlock",
      }).source
    ).toBe("```\ncode block\n```");
  });
});

describe("Square Markdown rendered editing", () => {
  it("renders Markdown into editable forum HTML", () => {
    expect(markdownToEditableHtml("# Keeper notes\n\n- clue")).toContain("<h1>");
    expect(markdownToEditableHtml("# Keeper notes\n\n- clue")).toContain(
      "<li>clue</li>"
    );
  });

  it("keeps Markdown image syntax as editable alt text instead of image HTML", () => {
    const html = markdownToEditableHtml(
      "Before ![Keeper map](https://example.com/map.png) after"
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("href=");
    expect(html).toContain("Keeper map");
  });

  it("turns edited forum HTML back into Markdown source", () => {
    const textNode = (text: string) =>
      ({
        nodeType: 3,
        textContent: text,
      } as ChildNode);
    const element = (tagName: string, childNodes: ChildNode[] = []) =>
      ({
        nodeType: 1,
        tagName,
        childNodes,
        children: childNodes.filter((node) => node.nodeType === 1),
        textContent: childNodes.map((node) => node.textContent || "").join(""),
      } as unknown as HTMLElement);
    const root = element("div", [
      element("h1", [textNode("Keeper notes")]),
      element("ul", [element("li", [textNode("clue")])]),
    ]);

    expect(editableElementToMarkdown(root)).toBe("# Keeper notes\n\n- clue");
  });
});
