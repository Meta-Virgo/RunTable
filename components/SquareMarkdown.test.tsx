import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SquareMarkdown } from "./SquareMarkdown";

describe("Square Markdown rendering", () => {
  it("renders forum-style Markdown while ignoring raw HTML", () => {
    const html = renderToStaticMarkup(
      <SquareMarkdown
        source={[
          "# Recruitment",
          "",
          "- Keeper: **Yves**",
          "- Formula: `.r 1d100`",
          "",
          "[Session notes](https://example.com/notes)",
          "",
          "<script>alert('nope')</script>",
        ].join("\n")}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Recruitment");
    expect(html).toContain("<strong>Yves</strong>");
    expect(html).toContain("<code>.r 1d100</code>");
    expect(html).toContain('href="https://example.com/notes"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
  });

  it("does not render remote Markdown images", () => {
    const html = renderToStaticMarkup(
      <SquareMarkdown source="![Keeper map](https://example.com/map.png)" />
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("src=");
    expect(html).toContain("Keeper map");
  });
});
