/** @jsxImportSource react */
import React, {
  useCallback,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useEffect,
  type ReactElement,
} from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import Uppy from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import "@uppy/core/css/style.min.css";

interface BlockNoteEditorProps {
  content: string;
  editorState: string;
  onChange: (content: string, editorState: string) => void;
  uploadUrl?: string;
}

export interface BlockNoteEditorRef {
  getEditorState: () => string;
}

const BlockNoteEditorReact = (
  {
    content,
    editorState,
    onChange,
    uploadUrl = "/api/images",
  }: BlockNoteEditorProps,
  ref: React.ForwardedRef<BlockNoteEditorRef>,
): ReactElement => {
  // Initialize Uppy synchronously to avoid race conditions
  const uppyInstance = useMemo(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ["image/*"],
        maxNumberOfFiles: 1,
      },
      autoProceed: true,
    });

    uppy.use(XHRUpload, {
      endpoint: `${uploadUrl}?pipeline=original`,
      formData: false,
      fieldName: "file",
      headers: {},
    });

    return uppy;
  }, [uploadUrl]);

  // Cleanup Uppy on unmount
  useEffect(() => {
    return () => {
      try {
        uppyInstance.cancelAll();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [uppyInstance]);

  // Custom upload function using Uppy
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      if (!uppyInstance) {
        console.error("Uppy not initialized");
        throw new Error("Uppy not initialized");
      }

      return new Promise((resolve, reject) => {
        try {
          console.log(
            "Starting upload for file:",
            file.name,
            file.type,
            file.size,
          );

          const fileId = uppyInstance.addFile({
            name: file.name,
            type: file.type,
            data: file,
          });

          console.log("Added file to Uppy with ID:", fileId);

          const handleSuccess = (uploadedFile: any, response: any) => {
            if (uploadedFile?.id === fileId) {
              console.log("Upload success for file:", fileId);
              console.log("Response status:", response.status);
              console.log("Response body:", response.body);

              const result = response.body as any;

              // API returns { success: true, url: "...", filePath: "..." }
              // Not { success: true, data: { url: "..." } }
              if (result.success && result.url) {
                uppyInstance.off("upload-success", handleSuccess);
                uppyInstance.off("upload-error", handleError);
                uppyInstance.removeFile(fileId);
                console.log("Upload completed successfully, URL:", result.url);
                resolve(result.url);
              } else {
                console.error(
                  "Upload failed: Invalid response structure",
                  result,
                );
                uppyInstance.off("upload-success", handleSuccess);
                uppyInstance.off("upload-error", handleError);
                uppyInstance.removeFile(fileId);
                reject(
                  new Error(
                    `Upload failed: No URL in response. Got: ${JSON.stringify(result)}`,
                  ),
                );
              }
            }
          };

          const handleError = (uploadedFile: any, error: any) => {
            if (uploadedFile?.id === fileId) {
              console.error("Upload error for file:", fileId, error);
              console.error("Error details:", JSON.stringify(error, null, 2));
              uppyInstance.off("upload-success", handleSuccess);
              uppyInstance.off("upload-error", handleError);
              uppyInstance.removeFile(fileId);
              reject(error);
            }
          };

          uppyInstance.on("upload-success", handleSuccess);
          uppyInstance.on("upload-error", handleError);

          console.log("Triggering upload for file:", fileId);
          uppyInstance.upload().catch((error) => {
            console.error("Upload promise rejected:", error);
            uppyInstance.off("upload-success", handleSuccess);
            uppyInstance.off("upload-error", handleError);
            reject(error);
          });
        } catch (error) {
          console.error("Exception in uploadFile:", error);
          reject(error);
        }
      });
    },
    [uppyInstance],
  );

  // Parse initial content
  const initialContent = useMemo((): PartialBlock[] | undefined => {
    if (editorState) {
      try {
        const parsed = JSON.parse(editorState);
        return parsed as PartialBlock[];
      } catch (e) {
        console.error("Failed to parse editor state:", e);
      }
    }
    return undefined;
  }, [editorState]);

  // Create BlockNote editor
  const editor = useCreateBlockNote({
    initialContent,
    uploadFile,
  });

  // When there's no editorState but HTML content exists, parse it into blocks
  const [htmlLoaded, setHtmlLoaded] = useState(false);
  useEffect(() => {
    if (!editorState && content && !htmlLoaded) {
      try {
        const blocks = editor.tryParseHTMLToBlocks(content);
        editor.replaceBlocks(editor.document, blocks);
      } catch (e) {
        console.error("Failed to parse HTML content into blocks:", e);
      }
      setHtmlLoaded(true);
    }
  }, [editor, editorState, content, htmlLoaded]);

  useImperativeHandle(ref, () => ({
    getEditorState: () => {
      const blocks = editor.document;
      return JSON.stringify(blocks);
    },
  }));

  // Handle editor changes
  const handleChange = useCallback(() => {
    const blocks = editor.document;
    const stateString = JSON.stringify(blocks);

    // Convert blocks to HTML for content
    let htmlContent = "";
    try {
      htmlContent = editor.blocksToHTMLLossy(blocks);
    } catch (e) {
      console.error("Failed to convert blocks to HTML:", e);
      htmlContent = "";
    }

    onChange(htmlContent, stateString);
  }, [editor, onChange]);

  return (
    <div className="blocknote-editor-wrapper" style={{ padding: "1rem" }}>
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
};

const ForwardedBlockNoteEditor = forwardRef(BlockNoteEditorReact);
ForwardedBlockNoteEditor.displayName = "BlockNoteEditorReact";

export default ForwardedBlockNoteEditor;
