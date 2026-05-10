import { component$, Slot } from "@qwik.dev/core";

export const AdminTable = component$(() => {
  return (
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <Slot />
      </table>
    </div>
  );
});
