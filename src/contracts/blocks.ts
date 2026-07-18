/**
 * Core → theme data contract for the page-builder block system. Blocks
 * register a `BlockDefinition` and receive `BlockData.data` as props — these
 * types carry no service/db dependency, so they're re-exported here rather
 * than requiring theme to import `~/db/schema` directly.
 */
export type {
	BlockData,
	BlockDefinition,
	FieldDefinition,
} from "~/db/schemas/shared";
