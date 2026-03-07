import { component$, useSignal, $ } from "@builder.io/qwik";

interface GroupImageUploadProps {
  name: string;
  label: string;
  value?: string | null;
}

export const GroupImageUpload = component$<GroupImageUploadProps>((props) => {
  const currentUrl = useSignal<string>(props.value ?? "");
  const uploading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handleFile$ = $(async (file: File) => {
    uploading.value = true;
    error.value = null;

    const res = await fetch(
      `/api/images?pipeline=standard&filename=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ""))}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-upload-path": "public/groups/",
        },
        body: file,
      },
    );

    uploading.value = false;

    if (!res.ok) {
      error.value = "Upload failed";
      return;
    }

    const json = await res.json();
    currentUrl.value = json.url ?? json.filePath ?? "";
  });

  return (
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">{props.label}</label>
      <div class="flex items-start gap-4">
        {currentUrl.value && (
          <img
            src={currentUrl.value}
            alt="preview"
            class="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
          />
        )}
        <div class="flex-1">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange$={async (e) => {
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              if (file) await handleFile$(file);
            }}
          />
          {uploading.value && (
            <p class="text-sm text-blue-600 mt-1">Uploading...</p>
          )}
          {error.value && (
            <p class="text-sm text-red-500 mt-1">{error.value}</p>
          )}
          {currentUrl.value && !uploading.value && (
            <p class="text-xs text-gray-400 mt-1 truncate">{currentUrl.value}</p>
          )}
        </div>
      </div>
      <input type="hidden" name={props.name} value={currentUrl.value} />
    </div>
  );
});
