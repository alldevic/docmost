import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSchema } from "@tiptap/core";
import { DOMSerializer, Node as PMNode, Schema } from "@tiptap/pm/model";
import codeBlockClasses from "@/features/editor/components/code-block/code-block.module.css";
import imageClasses from "@/features/editor/components/image/image-view.module.css";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onStatusParameters,
  WebSocketStatus,
  HocuspocusProviderWebsocket,
  onSyncedParameters,
} from "@hocuspocus/provider";
import {
  Editor,
  EditorContent,
  EditorProvider,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useAtomValue } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  currentPageEditModeAtom,
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
  showReadOnlyCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { ReadonlyBubbleMenu } from "@/features/editor/components/bubble-menu/readonly-bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import EmbedMenu from "@/features/editor/components/embed/embed-menu.tsx";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId, platformModifierKey } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";

// The copy shown until the collaborative editor has synced. Serialized straight to DOM
// from the page JSON: a second TipTap editor with React node views cost about as much
// as the live editor itself on large pages.
let staticSchema: Schema | null = null;

const IMAGE_ALIGN: Record<string, string> = {
  left: "alignLeft",
  right: "alignRight",
  floatLeft: "alignFloatLeft",
  floatRight: "alignFloatRight",
};

// The node views of code blocks and images wrap their content; the serialized copy gets the
// same wrappers and classes, so the live editor replaces it without a layout shift.
function dressStaticCopy(root: HTMLElement) {
  for (const pre of Array.from(root.querySelectorAll("pre"))) {
    const wrapper = document.createElement("div");
    wrapper.className = "codeBlock";
    const header = document.createElement("div");
    header.className = codeBlockClasses.headerGroup;
    header.contentEditable = "false";
    const actions = document.createElement("div");
    actions.className = codeBlockClasses.actionsGroup;
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    const language = document.createElement("span");
    language.className = codeBlockClasses.languageButton;
    language.textContent =
      pre.querySelector("code")?.className.match(/language-(\S+)/)?.[1] ?? "auto";
    actions.append(language);
    header.append(actions);
    pre.className =
      pre.dataset.wrap === "true"
        ? codeBlockClasses.lineWrap
        : codeBlockClasses.noLineWrap;
    pre.replaceWith(wrapper);
    wrapper.append(header, pre);
    // ProseMirror shows a trailing newline as an extra line (hack <br>)
    const code = pre.querySelector("code");
    if (code?.textContent?.endsWith("\n")) code.append(document.createElement("br"));
  }
  // details: the same markup as the node view of editor-ext/details
  for (const details of Array.from(root.querySelectorAll("details"))) {
    const dom = document.createElement("div");
    dom.setAttribute("data-type", "details");
    if (details.hasAttribute("open")) dom.setAttribute("open", "true");
    const button = document.createElement("button");
    button.setAttribute("data-type", "detailsButton");
    button.innerHTML =
      '<div><span class="ProseMirror-icon ProseMirror-icon-right-line"></span></div>';
    const container = document.createElement("div");
    container.setAttribute("data-type", "detailsContainer");
    container.append(...Array.from(details.childNodes));
    dom.append(button, container);
    details.replaceWith(dom);
  }
  // ProseMirror keeps empty text blocks and a hard break at the end of a block visible
  // with a trailing <br>
  for (const el of Array.from(root.querySelectorAll("p, h1, h2, h3, h4, h5, h6"))) {
    if (!el.lastChild || el.lastChild.nodeName === "BR") {
      el.append(document.createElement("br"));
    }
  }
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const wrapper = document.createElement("div");
    wrapper.className = `${imageClasses.imageWrapper} ${IMAGE_ALIGN[img.dataset.align ?? ""] ?? "alignCenter"}`;
    const width = img.getAttribute("width");
    if (width) wrapper.style.width = /^\d+$/.test(width) ? `${width}px` : width;
    img.replaceWith(wrapper);
    wrapper.append(img);
  }
}

function StaticPageContent({ content }: { content: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current) return;
    try {
      staticSchema ??= getSchema(mainExtensions);
      const doc = PMNode.fromJSON(staticSchema, content);
      ref.current.replaceChildren(
        DOMSerializer.fromSchema(staticSchema).serializeFragment(doc.content),
      );
      dressStaticCopy(ref.current);
    } catch (err) {
      console.error("static render failed, falling back to the editor", err);
      setFailed(true);
    }
  }, [content]);

  if (failed || !content || typeof content !== "object") {
    return (
      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={mainExtensions}
        content={content}
      />
    );
  }

  return (
    <div>
      <div
        ref={ref}
        className="tiptap ProseMirror"
        contentEditable={false}
        translate="no"
      />
    </div>
  );
}

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
  canComment?: boolean;
}

export default function PageEditor({
  pageId,
  editable,
  content,
  canComment,
}: PageEditorProps) {
  const collaborationURL = useCollaborationUrl();
  const isComponentMounted = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [showReadOnlyCommentPopup] = useAtom(showReadOnlyCommentPopupAtom);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [isRemoteSynced, setIsRemoteSynced] = useState(false);
  const [hasLocalCopy, setHasLocalCopy] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom,
  );
  const menuContainerRef = useRef(null);
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const canScroll = useCallback(
    () => Boolean(isComponentMounted.current && editorRef.current),
    [isComponentMounted],
  );
  const { handleScrollTo } = useEditorScroll({ canScroll });

  const userSpellcheckPref =
    currentUser?.user?.settings?.preferences?.spellcheck ?? true;

  // Providers only created once per pageId
  const providersRef = useRef<{
    local: IndexeddbPersistence;
    remote: HocuspocusProvider;
    socket: HocuspocusProviderWebsocket;
  } | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  useEffect(() => {
    if (!providersRef.current) {
      const documentName = `page.${pageId}`;
      const ydoc = new Y.Doc();
      const local = new IndexeddbPersistence(documentName, ydoc);
      const socket = new HocuspocusProviderWebsocket({
        url: collaborationURL,
      });
      const onLocalSyncedHandler = () => {
        setIsLocalSynced(true);
      };
      const onStatusHandler = (event: onStatusParameters) => {
        setYjsConnectionStatus(event.status);
      };
      const onSyncedHandler = (event: onSyncedParameters) => {
        setIsRemoteSynced(event.state);
        // the 7.5 s check below may have marked a slow first sync as disconnected
        if (event.state) setYjsConnectionStatus(socket.status);
      };
      const onAuthenticationFailedHandler = () => {
        const payload = jwtDecode(collabQuery?.token);
        const now = Date.now().valueOf() / 1000;
        const isTokenExpired = now >= payload.exp;
        if (isTokenExpired) {
          refetchCollabToken().then((result) => {
            if (result.data?.token) {
              socket.disconnect();
              setTimeout(() => {
                remote.configuration.token = result.data.token;
                socket.connect();
              }, 100);
            }
          });
        }
      };
      const remote = new HocuspocusProvider({
        websocketProvider: socket,
        name: documentName,
        document: ydoc,
        token: collabQuery?.token,
        onAuthenticationFailed: onAuthenticationFailedHandler,
        onStatus: onStatusHandler,
        onSynced: onSyncedHandler,
      });

      local.on("synced", () => {
        // a copy from an earlier visit: show the live editor right away,
        // remote updates are merged as they arrive
        if (ydoc.getXmlFragment("default").length > 0) {
          setHasLocalCopy(true);
        }
      });
      local.on("synced", onLocalSyncedHandler);
      providersRef.current = { socket, local, remote };
      setProvidersReady(true);
    } else {
      setProvidersReady(true);
    }
    // Only destroy on final unmount
    return () => {
      providersRef.current?.socket.destroy();
      providersRef.current?.remote.destroy();
      providersRef.current?.local.destroy();
      providersRef.current = null;
    };
  }, [pageId]);

  // Only connect/disconnect on tab/idle, not destroy
  useEffect(() => {
    if (!providersReady || !providersRef.current) return;
    const socket = providersRef.current.socket;

    if (
      isIdle &&
      documentState === "hidden" &&
      yjsConnectionStatus === WebSocketStatus.Connected
    ) {
      socket.disconnect();
      return;
    }
    if (
      documentState === "visible" &&
      yjsConnectionStatus === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      socket.connect();
    }
  }, [isIdle, documentState, providersReady, resetIdle]);

  // Attach here, to make sure the connection gets properly established
  providersRef.current?.remote.attach();

  const extensions = useMemo(() => {
    if (!providersReady || !providersRef.current || !currentUser?.user) {
      return mainExtensions;
    }

    const remoteProvider = providersRef.current.remote;

    return [
      ...mainExtensions,
      ...collabExtensions(remoteProvider, currentUser?.user),
    ];
  }, [providersReady, currentUser?.user]);

  const debouncedSendSaveCommand = useDebouncedCallback(() => {
    const payload = "forceSave";
    providersRef.current?.remote.sendStateless(payload);
  }, 300);

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (platformModifierKey(event) && event.code === "KeyS") {
              event.preventDefault();
              debouncedSendSaveCommand();
              return true;
            }
            if (event.key === "Tab") {
              const editor = editorRef.current;
              if (!editor) return false;
              event.preventDefault();
              return editor.view.someProp("handleKeyDown", (f) =>
                f(editor.view, event),
              );
            }
            if (platformModifierKey(event) && event.code === "KeyK") {
              searchSpotlight.open();
              return true;
            }
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (_view, event) => {
          if (!editorRef.current) return false;

          return handlePaste(
            editorRef.current,
            event,
            pageId,
            currentUser?.user.id,
          );
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!editorRef.current) return false;

          return handleFileDrop(editorRef.current, event, moved, pageId);
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
          // @ts-ignore
          editor.storage.pageId = pageId;
          handleScrollTo(editor);
          editorRef.current = editor;
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);
      },
    },
    [pageId, editable, extensions],
  );

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => {
      return ctx.editor?.isEditable ?? false;
    },
  });

  const debouncedUpdateContent = useDebouncedCallback((newContent: any) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        content: newContent,
        updatedAt: new Date(),
      });
    }
  }, 3000);

  const handleActiveCommentEvent = (event) => {
    const { commentId, resolved } = event.detail;

    if (resolved) {
      return;
    }

    setActiveCommentId(commentId);
    setAsideState({ tab: "comments", isAsideOpen: true });

    //wait if aside is closed
    setTimeout(() => {
      const selector = `div[data-comment-id="${commentId}"]`;
      const commentElement = document.querySelector(selector);
      commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  };

  useEffect(() => {
    document.addEventListener("ACTIVE_COMMENT_EVENT", handleActiveCommentEvent);
    return () => {
      document.removeEventListener(
        "ACTIVE_COMMENT_EVENT",
        handleActiveCommentEvent,
      );
    };
  }, []);

  useEffect(() => {
    setActiveCommentId(null);
    setShowCommentPopup(false);
  }, [pageId]);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (yjsConnectionStatus === WebSocketStatus.Connecting || !isSynced) {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }
    }, 7500);

    return () => clearTimeout(timeout);
  }, [yjsConnectionStatus, isSynced]);
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable && currentPageEditMode === PageEditMode.Edit);
  }, [currentPageEditMode, editor, editable]);

  const hasConnectedOnceRef = useRef(false);
  const [showStatic, setShowStatic] = useState(true);

  // A remote sync implies a connection. Waiting for the status atom as well raced with the
  // 7.5 s check above: on a slow device or link (a large page takes longer than that to
  // arrive) the status was forced to "disconnected" and the page stayed read-only for good.
  useEffect(() => {
    if (!hasConnectedOnceRef.current && isSynced) {
      hasConnectedOnceRef.current = true;
      setShowStatic(false);
    }
  }, [isSynced]);

  useEffect(() => {
    if (hasLocalCopy) setShowStatic(false);
  }, [hasLocalCopy]);

  if (showStatic) {
    return <StaticPageContent content={content} />;
  }

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} spellCheck={userSpellcheckPref} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && editorIsEditable && (
          <div>
            <EditorAiMenu editor={editor} />
            <EditorLinkMenu editor={editor} />
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableCellMenu editor={editor} appendTo={menuContainerRef} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <PdfMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <SubpagesMenu editor={editor} />
            <EmbedMenu editor={editor} />
            <ColumnsMenu editor={editor} />
          </div>
        )}
        {editor &&
          !editorIsEditable &&
          (editable || canComment) &&
          providersRef.current && <ReadonlyBubbleMenu editor={editor} />}
        {showCommentPopup && <CommentDialog editor={editor} pageId={pageId} />}
        {showReadOnlyCommentPopup && (
          <CommentDialog editor={editor} pageId={pageId} readOnly />
        )}
      </div>
      <div
        onClick={() => editor.commands.focus("end")}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  );
}
