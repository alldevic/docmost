import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Group, Select, Text, UnstyledButton } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { useEffect, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconTextWrap,
  IconTextWrapDisabled,
} from "@tabler/icons-react";
import classes from "./code-block.module.css";
import React from "react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";

function MermaidErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className={classes.error}>
      <Text size="sm">{t("Failed to render Mermaid diagram")}</Text>
    </div>
  );
}

const MermaidView = React.lazy(
  () => import("@/features/editor/components/code-block/mermaid-view.tsx"),
);

// Sorted once: every code block used to sort ~190 names on each render.
let sortedLanguages: string[] | null = null;
function languageList(lowlight: { listLanguages(): string[] }): string[] {
  return (sortedLanguages ??= lowlight.listLanguages().sort());
}

// A page can have hundreds of code blocks. Mantine's Select (combobox, floating
// dropdown, ~190 options) is mounted only when the user opens it.
function LanguageSelect({
  value,
  languages,
  onChange,
  disabled,
}: {
  value: string | null;
  languages: () => string[];
  onChange: (language: string) => void;
  disabled: boolean;
}) {
  const [active, setActive] = useState(false);
  if (!active) {
    return (
      <UnstyledButton
        className={classes.languageButton}
        onClick={() => setActive(true)}
        disabled={disabled}
        aria-haspopup="listbox"
      >
        {value || "auto"}
      </UnstyledButton>
    );
  }
  return (
    <Select
      placeholder="auto"
      checkIconPosition="right"
      data={languages()}
      value={value}
      onChange={(v) => {
        onChange(v);
        setActive(false);
      }}
      onDropdownClose={() => setActive(false)}
      defaultDropdownOpened
      autoFocus
      searchable
      size="sm"
      style={{ maxWidth: "130px" }}
      classNames={{ input: classes.selectInput }}
      disabled={disabled}
    />
  );
}

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, extension, editor, getPos } = props;
  const { language, wrap } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    setLanguageValue(language || null);
  }, [language]);

  useEffect(() => {
    // only mermaid blocks change with the selection (source shown while selected)
    if (language !== "mermaid") return;
    const updateSelection = () => {
      const { state } = editor;
      const { from, to } = state.selection;
      // Check if the selection intersects with the node's range
      const isNodeSelected =
        (from >= getPos() && from < getPos() + node.nodeSize) ||
        (to > getPos() && to <= getPos() + node.nodeSize);
      setIsSelected(isNodeSelected);
    };

    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, getPos(), node.nodeSize, language]);

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  function toggleWrapLines() {
    updateAttributes({
      wrap: !wrap,
    });
  }

  function downloadCode() {
    const content = node?.textContent || "";
    let filename = "code";

    const hasExtension =
      filename.includes(".") &&
      filename.lastIndexOf(".") > filename.lastIndexOf("/");
    if (!hasExtension && languageValue) {
      filename += `.${languageValue}`;
    }
    if (!hasExtension && !languageValue) {
      filename += ".txt";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <NodeViewWrapper className="codeBlock">
      <Group
        justify="space-between"
        contentEditable={false}
        className={classes.headerGroup}
        mb={0}
      >
        <Group gap="xs" className={classes.actionsGroup}>
          {/* native titles: a Mantine Tooltip per button is a floating
              instance per code block */}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={toggleWrapLines}
            title={wrap ? t("Disable line wrap") : t("Enable line wrap")}
            aria-label={wrap ? t("Disable line wrap") : t("Enable line wrap")}
          >
            {wrap ? (
              <IconTextWrapDisabled size={14} />
            ) : (
              <IconTextWrap size={14} />
            )}
          </ActionIcon>

          <LanguageSelect
            value={languageValue}
            languages={() => languageList(extension.options.lowlight)}
            onChange={changeLanguage}
            disabled={!editor.isEditable}
          />

          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={downloadCode}
            title={t("Download code")}
            aria-label={t("Download code")}
          >
            <IconDownload size={14} />
          </ActionIcon>

          <CopyButton value={node?.textContent} timeout={2000}>
            {({ copied, copy }) => (
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                size="sm"
                onClick={copy}
                title={copied ? t("Copied") : t("Copy")}
                aria-label={copied ? t("Copied") : t("Copy")}
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </ActionIcon>
            )}
          </CopyButton>
        </Group>
      </Group>

      <pre
        spellCheck="false"
        className={wrap ? classes.lineWrap : classes.noLineWrap}
        hidden={
          ((language === "mermaid" && !editor.isEditable) ||
            (language === "mermaid" && !isSelected)) &&
          node.textContent.length > 0
        }
      >
        {/* @ts-ignore */}
        <NodeViewContent as="code" className={`language-${language}`} />
      </pre>

      {language === "mermaid" && (
        <ErrorBoundary FallbackComponent={MermaidErrorFallback}>
          <Suspense fallback={null}>
            <MermaidView props={props} />
          </Suspense>
        </ErrorBoundary>
      )}
    </NodeViewWrapper>
  );
}
