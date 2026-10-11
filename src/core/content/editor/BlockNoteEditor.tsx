import { component$, type QRL, useSignal } from "@qwik.dev/core";
import { qwikify$ } from "@qwik.dev/react";
import React, { Suspense } from "react";
import type { InsertLinkRequest } from "./BlockNoteEditorReact";
import { EditorLinkPicker } from "./EditorLinkPicker";

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
	textOnly?: boolean;
	/**
	 * Show the internal link picker (admin editors only): it searches scopes, pages, notes, articles and
	 * module items and links the selected text with a `ref:` reference.
	 */
	linkPicker?: boolean;
}

export const BlockNoteEditor = component$<BlockNoteEditorProps>(
	({ editorState, content, onChange$, uploadUrl, textOnly, linkPicker }) => {
		const insertLink = useSignal<InsertLinkRequest | null>(null);
		return (
			<div class="blocknote-editor-container">
				{linkPicker && (
					<EditorLinkPicker
						onPick$={(href: string, label: string) => {
							insertLink.value = {
								href,
								label,
								nonce: (insertLink.value?.nonce ?? 0) + 1,
							};
						}}
					/>
				)}
				<QwikBlockNoteEditor
					editorState={editorState || ""}
					content={content || ""}
					onChange$={onChange$}
					uploadUrl={uploadUrl}
					textOnly={textOnly}
					insertLink={insertLink.value}
				/>
			</div>
		);
	},
);

export default BlockNoteEditor;
