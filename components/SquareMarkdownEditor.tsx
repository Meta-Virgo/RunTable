import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Italic,
  Link,
  List,
  ListOrdered,
  Pencil,
  Quote,
  LucideIcon,
} from "lucide-react";
import {
  applyMarkdownFormat,
  editableElementToMarkdown,
  markdownToEditableHtml,
  MarkdownFormat,
} from "../services/squareMarkdown";
import { cn } from "./UI";
import { SquareMarkdown } from "./SquareMarkdown";

type SquareMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  previewVariant?: "preview" | "detail" | "comment";
  initialMode?: "source" | "preview";
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  rows?: number;
  showToolbar?: boolean;
  showModeSwitch?: boolean;
  livePreview?: boolean;
  renderedEditing?: boolean;
  maxHeight?: number;
  toolbarExtra?: React.ReactNode;
};

const formatActions: {
  format: MarkdownFormat;
  title: string;
  icon: LucideIcon;
}[] = [
  { format: "bold", title: "Bold", icon: Bold },
  { format: "italic", title: "Italic", icon: Italic },
  { format: "link", title: "Link", icon: Link },
  { format: "quote", title: "Quote", icon: Quote },
  { format: "bulletList", title: "Bulleted list", icon: List },
  { format: "numberedList", title: "Numbered list", icon: ListOrdered },
  { format: "inlineCode", title: "Inline code", icon: Code2 },
  { format: "codeBlock", title: "Code block", icon: Code2 },
];

type RenderedFormatCommand =
  | { type: "exec"; name: string }
  | { type: "link" }
  | { type: "inline-code" }
  | { type: "wrap-block"; tagName: "blockquote" | "pre" };

const getRenderedFormatCommand = (
  format: MarkdownFormat
): RenderedFormatCommand => {
  if (format === "bold") return { type: "exec", name: "bold" };
  if (format === "italic") return { type: "exec", name: "italic" };
  if (format === "link") return { type: "link" };
  if (format === "quote") return { type: "wrap-block", tagName: "blockquote" };
  if (format === "bulletList") {
    return { type: "exec", name: "insertUnorderedList" };
  }
  if (format === "numberedList") {
    return { type: "exec", name: "insertOrderedList" };
  }
  if (format === "codeBlock") return { type: "wrap-block", tagName: "pre" };
  return { type: "inline-code" };
};

export const SquareMarkdownEditor: React.FC<SquareMarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  previewVariant = "preview",
  initialMode = "source",
  onPaste,
  rows = 3,
  showToolbar = true,
  showModeSwitch = true,
  livePreview = false,
  renderedEditing = false,
  maxHeight = 180,
  toolbarExtra,
}) => {
  const [mode, setMode] = useState<"source" | "preview">(initialMode);
  const [renderedHtml, setRenderedHtml] = useState(() =>
    value.trim() ? markdownToEditableHtml(value) : ""
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const isEditingRenderedRef = useRef(false);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    if (livePreview || mode === "source") {
      resizeTextarea();
    }
  }, [livePreview, mode, value, maxHeight]);

  useEffect(() => {
    if (!renderedEditing || isEditingRenderedRef.current) return;

    setRenderedHtml(value.trim() ? markdownToEditableHtml(value) : "");
    if (!value.trim() && editableRef.current) {
      editableRef.current.innerHTML = "";
    }
  }, [renderedEditing, value]);

  const syncRenderedSource = () => {
    const editable = editableRef.current;
    if (!editable) return;
    isEditingRenderedRef.current = true;
    onChange(editableElementToMarkdown(editable));
    requestAnimationFrame(() => {
      isEditingRenderedRef.current = false;
    });
  };

  const applyFormat = (format: MarkdownFormat) => {
    if (renderedEditing) {
      applyRenderedFormat(format);
      return;
    }

    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const next = applyMarkdownFormat({
      source: value,
      selectionStart,
      selectionEnd,
      format,
    });

    onChange(next.source);

    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const applyRenderedFormat = (format: MarkdownFormat) => {
    const editable = editableRef.current;
    if (!editable) return;

    editable.focus();
    const command = getRenderedFormatCommand(format);

    if (command.type === "wrap-block") {
      wrapSelectedBlock(command.tagName);
    } else if (command.type === "link") {
      restoreSelectionAfterPrompt((href) => {
        if (href) document.execCommand("createLink", false, href);
      });
    } else if (command.type === "inline-code") {
      wrapSelectedInline("code");
    } else {
      document.execCommand(command.name, false);
    }

    syncRenderedSource();
  };

  const restoreSelectionAfterPrompt = (apply: (href: string | null) => void) => {
    const selection = window.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null;
    const href = window.prompt("Enter link", "https://");

    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }

    apply(href);
  };

  const wrapSelectedBlock = (tagName: "blockquote" | "pre") => {
    const editable = editableRef.current;
    const selection = window.getSelection();
    if (!editable || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editable.contains(range.commonAncestorContainer)) return;

    const wrapper = document.createElement(tagName);

    if (selection.toString()) {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    } else {
      wrapper.appendChild(
        document.createElement(tagName === "pre" ? "code" : "p")
      );
      range.insertNode(wrapper);
    }

    selectNodeContents(wrapper);
  };

  const wrapSelectedInline = (tagName: "code") => {
    const editable = editableRef.current;
    const selection = window.getSelection();
    if (!editable || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editable.contains(range.commonAncestorContainer)) return;

    const wrapper = document.createElement(tagName);

    if (selection.toString()) {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    } else {
      wrapper.textContent = "code";
      range.insertNode(wrapper);
    }

    selectNodeContents(wrapper);
  };

  const selectNodeContents = (node: Node) => {
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(node);
    selection.addRange(nextRange);
  };

  return (
    <div
      className={cn("space-y-2", className)}
      data-elastic-scroll-ignore="true"
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {(showToolbar || showModeSwitch || toolbarExtra) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {(showToolbar || toolbarExtra) && (
            <div className="flex flex-wrap items-center gap-1">
              {showToolbar &&
                formatActions.map(({ format, title, icon: Icon }) => (
                  <button
                    key={format}
                    type="button"
                    aria-label={title}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyFormat(format)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-dicecho-muted hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon size={14} />
                  </button>
                ))}
              {toolbarExtra && (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    showToolbar &&
                      "ml-1 border-l border-dicecho-border/35 pl-2"
                  )}
                >
                  {toolbarExtra}
                </div>
              )}
            </div>
          )}
          {showModeSwitch && !livePreview && !renderedEditing && (
            <div className="inline-flex items-center rounded-md border border-dicecho-border/40 bg-dicecho-panel/70 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("source")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 transition-colors",
                  mode === "source"
                    ? "bg-dicecho-primary/20 text-white"
                    : "text-dicecho-muted hover:text-slate-200"
                )}
              >
                <Pencil size={12} />
                Markdown
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 transition-colors",
                  mode === "preview"
                    ? "bg-dicecho-primary/20 text-white"
                    : "text-dicecho-muted hover:text-slate-200"
                )}
              >
                <Eye size={12} />
                Preview
              </button>
            </div>
          )}
        </div>
      )}

      {renderedEditing ? (
        <div className="relative">
          {!value.trim() && (
            <div className="pointer-events-none absolute left-0 top-0 text-dicecho-muted">
              {placeholder}
            </div>
          )}
          <div
            ref={editableRef}
            className={cn(
              "square-markdown square-markdown-preview min-h-[80px] w-full outline-none text-slate-200 custom-scrollbar",
              textareaClassName
            )}
            contentEditable
            dangerouslySetInnerHTML={{
              __html: renderedHtml,
            }}
            suppressContentEditableWarning
            role="textbox"
            aria-label={placeholder}
            onInput={syncRenderedSource}
            onBlur={syncRenderedSource}
            onPaste={(event) => {
              onPaste?.(
                event as unknown as React.ClipboardEvent<HTMLTextAreaElement>
              );
              const text = event.clipboardData.getData("text/plain");
              const hasImage = Array.from(event.clipboardData.items).some(
                (item) => item.type.startsWith("image/")
              );
              if (!text && hasImage) {
                event.preventDefault();
                syncRenderedSource();
                return;
              }
              if (!text) return;
              event.preventDefault();
              document.execCommand("insertText", false, text);
              syncRenderedSource();
            }}
            onWheel={(e) => e.stopPropagation()}
          />
        </div>
      ) : !livePreview && mode === "preview" ? (
        <div className="min-h-[72px] rounded-lg border border-dicecho-border/40 bg-dicecho-panel/50 px-3 py-2">
          {value.trim() ? (
            <SquareMarkdown source={value} variant={previewVariant} />
          ) : (
            <div className="text-sm text-dicecho-muted">{placeholder}</div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={cn(
            "w-full bg-transparent border-none focus:ring-0 outline-none text-slate-200 placeholder:text-dicecho-muted resize-none custom-scrollbar",
            textareaClassName
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(resizeTextarea);
          }}
          onPaste={onPaste}
          onWheel={(e) => e.stopPropagation()}
          rows={rows}
        />
      )}
      {livePreview && value.trim() && (
        <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/50 px-3 py-2">
          <SquareMarkdown source={value} variant={previewVariant} />
        </div>
      )}
    </div>
  );
};
