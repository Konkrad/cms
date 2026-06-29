import { component$, Slot } from "@qwik.dev/core";

type SetupLayoutProps = {
  title: string;
  description?: string;
  backHref?: string;
};

export const SetupLayout = component$<SetupLayoutProps>((props) => {
  return (
    <div class="container mx-auto px-4 py-10 max-w-4xl">
      <div class="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold">{props.title}</h1>
          {props.description ? (
            <p class="text-text-secondary mt-2">{props.description}</p>
          ) : null}
        </div>
        {props.backHref ? (
          <a
            href={props.backHref}
            class="text-primary hover:text-primary text-sm font-medium"
          >
            Back
          </a>
        ) : null}
      </div>

      <div class="space-y-8">
        <Slot />
      </div>
    </div>
  );
});
