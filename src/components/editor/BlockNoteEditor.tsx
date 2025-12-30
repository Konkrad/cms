import { component$, type QRL } from "@builder.io/qwik";
import { qwikify$ } from "@builder.io/qwik-react";
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
  onChange$: QRL<(content: string, editorState: string) => void>;
  uploadUrl?: string;
}

export const BlockNoteEditor = component$<BlockNoteEditorProps>(
  ({ editorState, onChange$, uploadUrl }) => {
    return (
      <div class="blocknote-editor-container">
        <QwikBlockNoteEditor
          editorState={editorState || ""}
          content=""
          onChange$={onChange$}
          uploadUrl={uploadUrl}
        />
      </div>
    );
  },
);

export default BlockNoteEditor;
