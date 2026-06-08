import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SquareMarkdownProps = {
  source: string;
  variant?: "preview" | "detail" | "comment";
};

const variantClassName: Record<NonNullable<SquareMarkdownProps["variant"]>, string> = {
  preview: "square-markdown square-markdown-preview",
  detail: "square-markdown square-markdown-detail",
  comment: "square-markdown square-markdown-comment",
};

export const SquareMarkdown: React.FC<SquareMarkdownProps> = ({
  source,
  variant = "preview",
}) => {
  return (
    <div className={variantClassName[variant]}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => {
          const trimmed = url.trim();
          if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
          if (trimmed.startsWith("/")) return trimmed;
          return "";
        }}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </a>
          ),
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
};
