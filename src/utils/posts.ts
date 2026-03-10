export function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function toPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}
