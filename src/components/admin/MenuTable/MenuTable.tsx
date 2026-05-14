import { component$ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { qwikify$ } from "@qwik.dev/react";
import { MenuTable as MenuTableReact } from "./MenuTableReact";
import type { MenuItem } from "./MenuTableReact";

const QwikMenuTable = qwikify$(MenuTableReact, {
  eagerness: "load",
  clientOnly: true,
});

interface ActionResult {
  success: boolean;
  error?: string;
}

interface MenuTableProps {
  mainItems: MenuItem[];
  footerItems: MenuItem[];
  staticUrls: string[];
  onMove$: QRL<
    (params: {
      movedItemId: string;
      targetItemId?: string;
      mode: "before" | "as-child" | "to-hidden";
      menuName: "main" | "footer";
    }) => Promise<ActionResult>
  >;
  onUpdate$: QRL<
    (params: {
      menuName: string;
      menuItemId: string;
      label: string;
      url: string;
      parentId?: string;
      target: string;
      icon?: string;
    }) => Promise<ActionResult>
  >;
  onAdd$: QRL<
    (params: {
      menuName: "main" | "footer";
      label: string;
      url: string;
      icon?: string;
      hidden?: boolean;
    }) => Promise<ActionResult>
  >;
}

export const MenuTable = component$<MenuTableProps>((props) => {
  return (
    <QwikMenuTable
      mainItems={props.mainItems}
      footerItems={props.footerItems}
      staticUrls={props.staticUrls}
      onMove$={props.onMove$}
      onUpdate$={props.onUpdate$}
      onAdd$={props.onAdd$}
    />
  );
});
