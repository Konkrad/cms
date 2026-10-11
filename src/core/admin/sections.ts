/**
 * Core admin sections that exist on the root scope only (system sections). The `[scope]`
 * layout answers 404 when one is opened on another scope; their handlers also call
 * `requireSystemAdmin`.
 */
export const ROOT_ONLY_SECTIONS: readonly string[] = [
	"users",
	"pages",
	"tags",
	"notifications",
];
