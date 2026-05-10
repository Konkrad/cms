import { component$ } from "@qwik.dev/core";

interface VisibilitySelectorProps {
  name?: string;
  value?: "global" | "group-only";
  disabled?: boolean;
  isGroupContext?: boolean;
}

export const VisibilitySelector = component$<VisibilitySelectorProps>(
  ({ name = "visibility", value = "global", disabled = false, isGroupContext = true }) => {
    return (
      <div class="space-y-3">
        <label class="block text-sm font-medium text-gray-700">
          Visibility
        </label>
        <div class="space-y-2">
          <label class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name={name}
              value="global"
              checked={value === "global"}
              disabled={disabled}
              class="w-4 h-4 text-blue-600"
            />
            <div class="flex-1">
              <div class="font-medium text-gray-900">Global</div>
              <div class="text-sm text-gray-600">
                Visible to all users on the platform
              </div>
            </div>
          </label>

          {isGroupContext && (
            <label class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name={name}
                value="group-only"
                checked={value === "group-only"}
                disabled={disabled}
                class="w-4 h-4 text-blue-600"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900">Group Only</div>
                <div class="text-sm text-gray-600">
                  Only visible to members of this group
                </div>
              </div>
            </label>
          )}
        </div>
      </div>
    );
  }
);
