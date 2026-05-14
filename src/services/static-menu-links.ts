export type StaticMenuLink = {
  key: string;
  label: string;
  url: string;
};

// Curated list of global static routes that do not come from the pages table.
export const STATIC_MENU_LINKS: StaticMenuLink[] = [
  {
    key: "archive-posts",
    label: "Archive",
    url: "/archive/posts",
  },
  {
    key: "login",
    label: "Login",
    url: "/login",
  },
];
