import {
  ActionIcon,
  Button,
  Dialog,
  Flex,
  Input,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowNarrowDown,
  IconArrowNarrowUp,
  IconLetterCase,
  IconReplace,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEditor } from "@tiptap/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchAndReplaceStateAtom } from "@/features/editor/components/search-and-replace/atoms/search-and-replace-state-atom.ts";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import "./style.css";
import { getHotkeyHandler, useToggle } from "@mantine/hooks";
import { useLocation } from "react-router-dom";

interface PageFindDialogDialogProps {
  editor: ReturnType<typeof useEditor>;
}

function SearchAndReplaceDialog({ editor }: PageFindDialogDialogProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [pageFindState, setPageFindState] = useAtom(searchAndReplaceStateAtom);
  const inputRef = useRef(null);

  const searchInputEvent = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  const replaceInputEvent = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReplaceText(event.target.value);
  };

  const closeDialog = () => {
    setSearchText("");
    setPageFindState({ isOpen: false });
  };

  const goToSelection = () => {
    if (!editor) return;

    const { results, resultIndex } = editor.storage.searchAndReplace;
    const position: Range = results[resultIndex];

    if (!position) return;

    // @ts-ignore
    editor.commands.setTextSelection(position);

    const { node } = editor.view.domAtPos(editor.state.selection.anchor);
    node instanceof HTMLElement &&
      node.scrollIntoView({ behavior: "smooth", block: "center" });

    editor.commands.setTextSelection(0);
  };

  const next = () => {
    editor.commands.nextSearchResult();
    goToSelection();
  };

  const previous = () => {
    editor.commands.previousSearchResult();
    goToSelection();
  };

  const replace = () => {
    editor.commands.setReplaceTerm(replaceText);
    editor.commands.replace();
    goToSelection();
  };

  const replaceAll = () => {
    editor.commands.setReplaceTerm(replaceText);
    editor.commands.replaceAll();
  };

  useEffect(() => {
    editor.commands.setSearchTerm(searchText);
    editor.commands.resetIndex();
    editor.commands.selectCurrentItem();
  }, [searchText]);

  const handleOpenEvent = (e) => {
    setPageFindState({ isOpen: true });
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
    );
    if (selectedText !== "") {
      setSearchText(selectedText);
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleCloseEvent = (e) => {
    closeDialog();
  };

  useEffect(() => {
    !pageFindState.isOpen && closeDialog();

    document.addEventListener("openFindDialogFromEditor", handleOpenEvent);
    document.addEventListener("closeFindDialogFromEditor", handleCloseEvent);

    return () => {
      document.removeEventListener("openFindDialogFromEditor", handleOpenEvent);
      document.removeEventListener(
        "closeFindDialogFromEditor",
        handleCloseEvent,
      );
    };
  }, [pageFindState.isOpen]);

  const [replaceButton, replaceButtonToggle] = useToggle([
    { isReplaceShow: false, color: "gray" },
    { isReplaceShow: true, color: "blue" },
  ]);

  const [caseSensitive, caseSensitiveToggle] = useToggle([
    { isCaseSensitive: false, color: "gray" },
    { isCaseSensitive: true, color: "blue" },
  ]);

  useEffect(() => {
    editor.commands.setCaseSensitive(caseSensitive.isCaseSensitive);
    editor.commands.resetIndex();
    goToSelection();
  }, [caseSensitive]);

  const resultsCount = useMemo(
    () =>
      editor?.storage?.searchAndReplace?.results.length > 0
        ? editor?.storage?.searchAndReplace?.resultIndex +
          1 +
          "/" +
          editor?.storage?.searchAndReplace?.results.length
        : t("Not found"),
    [
      editor?.storage?.searchAndReplace?.resultIndex,
      editor?.storage?.searchAndReplace?.results.length,
    ],
  );

  const location = useLocation();
  useEffect(() => {
    closeDialog();
  }, [location]);

  return (
    <Dialog
      className="find-dialog"
      opened={pageFindState.isOpen}
      zIndex={999}
      size="lg"
      radius="md"
      w={"auto"}
      position={{ top: 0, right: 50 }}
      withBorder
      transitionProps={{ transition: "slide-down" }}
    >
      <Stack gap="xs">
        <Flex align="center" gap="xs">
          <Input
            ref={inputRef}
            placeholder={t("Find")}
            leftSection={<IconSearch size={16} />}
            rightSection={
              <Text size="xs" ta="right">
                {resultsCount}
              </Text>
            }
            rightSectionWidth="70"
            rightSectionPointerEvents="all"
            size="xs"
            onChange={searchInputEvent}
            value={searchText}
            autoFocus
            onKeyDown={getHotkeyHandler([
              ["Enter", next],
              ["shift+Enter", previous],
              ["alt+C", caseSensitiveToggle],
              ["alt+R", replaceButtonToggle],
            ])}
          />

          <ActionIcon.Group>
            <Tooltip label={t("Previous Match (Shift+Enter)")} zIndex={9999}>
              <ActionIcon variant="subtle" color="gray" onClick={previous}>
                <IconArrowNarrowUp
                  style={{ width: "70%", height: "70%" }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("Next Match (Enter)")} zIndex={9999}>
              <ActionIcon variant="subtle" color="gray" onClick={next}>
                <IconArrowNarrowDown
                  style={{ width: "70%", height: "70%" }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("Match Case (Alt+C)")} zIndex={9999}>
              <ActionIcon
                variant="subtle"
                color={caseSensitive.color}
                onClick={() => caseSensitiveToggle()}
              >
                <IconLetterCase
                  style={{ width: "70%", height: "70%" }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("Replace")} zIndex={9999}>
              <ActionIcon
                variant="subtle"
                color={replaceButton.color}
                onClick={() => replaceButtonToggle()}
              >
                <IconReplace
                  style={{ width: "70%", height: "70%" }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("Close (Escape)")} zIndex={9999}>
              <ActionIcon variant="subtle" color="gray" onClick={closeDialog}>
                <IconX style={{ width: "70%", height: "70%" }} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          </ActionIcon.Group>
        </Flex>
        {replaceButton.isReplaceShow && (
          <Flex align="center" gap="xs">
            <Input
              placeholder={t("Replace")}
              leftSection={<IconReplace size={16} />}
              rightSection={<div></div>}
              rightSectionWidth="70"
              rightSectionPointerEvents="all"
              size="xs"
              autoFocus
              onChange={replaceInputEvent}
              value={replaceText}
              onKeyDown={getHotkeyHandler([
                ["Enter", replace],
                ["ctrl+alt+Enter", replaceAll],
              ])}
            />
            <ActionIcon.Group>
              <Tooltip label={t("Replace (Enter)")} zIndex={9999}>
                <ActionIcon variant="subtle" color="gray" onClick={replace}>
                  <IconReplace
                    style={{ width: "70%", height: "70%" }}
                    stroke={1.5}
                  />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("Replace All (Ctrl+Alt+Enter)")} zIndex={9999}>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={replaceAll}
                >
                  {t("Replace All")}
                </Button>
              </Tooltip>
            </ActionIcon.Group>
          </Flex>
        )}
      </Stack>
    </Dialog>
  );
}

export default SearchAndReplaceDialog;
