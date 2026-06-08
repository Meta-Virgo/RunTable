import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SquareMarkdownEditor } from "./SquareMarkdownEditor";

describe("Square Markdown editor", () => {
  it("offers formatting controls on a rendered editable surface", () => {
    const html = renderToStaticMarkup(
      <SquareMarkdownEditor
        value="# Keeper notes"
        onChange={vi.fn()}
        placeholder="Write with Markdown"
        previewVariant="comment"
        renderedEditing
      />
    );

    expect(html).not.toContain("Preview");
    expect(html).toContain('aria-label="Bold"');
    expect(html).not.toContain("<textarea");
    expect(html).toContain('contenteditable="true"');
    expect(html).toContain("<h1");
    expect(html).toContain("Keeper notes");
  });

  it("can render as a plain reply box without formatting controls", () => {
    const html = renderToStaticMarkup(
      <SquareMarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="Reply"
        showToolbar={false}
        showModeSwitch={false}
      />
    );

    expect(html).not.toContain("Markdown");
    expect(html).not.toContain("Preview");
    expect(html).not.toContain('title="Bold"');
    expect(html).toContain("Reply");
  });
});
