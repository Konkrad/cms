export type StaticMenuLink = {
  key: string;
  label: string;
  url: string;
};

// Curated list of global static routes that do not come from the pages table.
export const STATIC_MENU_LINKS: StaticMenuLink[] = [
  { key: "events",     label: "Events",      url: "/events" },
  { key: "jobs",       label: "Jobs",        url: "/jobs" },
  { key: "elections",  label: "Elections",   url: "/elections" },
  { key: "communities", label: "Communities", url: "/communities" },
  { key: "archive-posts", label: "Archive",  url: "/archive/posts" },
  { key: "login",      label: "Login",       url: "/login" },
];
