import { component$, type QRL } from "@qwik.dev/core";
import { qwikify$ } from "@qwik.dev/react";
import React, { Suspense } from "react";

// Lazy load the React component to avoid SSR import issues
const LazyBlockNoteEditorReact = React.lazy(
  () => import("./BlockNoteEditorReact"),
);

const ReactLoader = (props: any) => {
  return React.createElement(
    Suspense,
    {
      fallback: React.createElement(
        "div",
        { style: { padding: "2rem", textAlign: "center" } },
        "Loading editor...",
      ),
    },
    React.createElement(LazyBlockNoteEditorReact, props),
  );
};

const QwikBlockNoteEditor = qwikify$(ReactLoader, {
  eagerness: "visible",
  clientOnly: true,
});

interface BlockNoteEditorProps {
  editorState: string | null;
  content?: string;
  onChange$: QRL<(content: string, editorState: string) => void>;
  uploadUrl?: string;
}

export const BlockNoteEditor = component$<BlockNoteEditorProps>(
  ({ editorState, content, onChange$, uploadUrl }) => {
    return (
      <div class="blocknote-editor-container">
        <QwikBlockNoteEditor
          editorState={editorState || ""}
          content={content || ""}
          onChange$={onChange$}
          uploadUrl={uploadUrl}
        />
      </div>
    );
  },
);

export default BlockNoteEditor;
