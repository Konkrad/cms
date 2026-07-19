/**
 * Block registry — the single source of truth for the page builder.
 *
 * `blockRegistry` is used by core's BlockRenderer to render blocks at runtime.
 * `blockDefinitions` is consumed by component-loader.service.ts to drive the
 * admin picker — so adding or removing a block here is the only change needed.
 *
 * The "dynamic" blocks (DealsListBlock, GroupsListBlock, HeroSectionBlock,
 * PastEventsBlock, PostsListBlock, UpcomingEventsBlock) have no route loader
 * to supply them data, so each delegates its data-fetching/pagination to a
 * core-owned headless composable under `~/components/builder/blocks/*`
 * (`useDealsList`, `useGroupsList`, etc.) — the block itself only renders.
 * Never call `~/services/*`/`~/db/*`/`~/utils/server-auth` directly from a
 * block; add a new composable in core instead.
 */
import type { BlockDefinition } from "~/contracts/blocks";
import AccordionBlock, {
	definition as AccordionBlockDef,
} from "./AccordionBlock/AccordionBlock";
import ActionButtonBlock, {
	definition as ActionButtonBlockDef,
} from "./ActionButtonBlock";
import CalloutBlock, {
	definition as CalloutBlockDef,
} from "./CalloutBlock/CalloutBlock";
import DealsListBlock, {
	definition as DealsListBlockDef,
} from "./DealsListBlock";
import EmbedBlock, {
	definition as EmbedBlockDef,
} from "./EmbedBlock/EmbedBlock";
import FeatureBlock, { definition as FeatureBlockDef } from "./FeatureBlock";
import GroupsListBlock, {
	definition as GroupsListBlockDef,
} from "./GroupsListBlock";
import HeroSectionBlock, {
	definition as HeroSectionBlockDef,
} from "./HeroSectionBlock";
import ImageBlock, { definition as ImageBlockDef } from "./ImageBlock";
import PastEventsBlock, {
	definition as PastEventsBlockDef,
} from "./PastEventsBlock";
import PostsListBlock, {
	definition as PostsListBlockDef,
} from "./PostsListBlock";
import QuoteBlock, {
	definition as QuoteBlockDef,
} from "./QuoteBlock/QuoteBlock";
import SpacerBlock, { definition as SpacerBlockDef } from "./SpacerBlock";
import SurveyFormBlock, {
	definition as SurveyFormBlockDef,
} from "./SurveyFormBlock";
import TextBlock, { definition as TextBlockDef } from "./TextBlock";
import TitleBlock, { definition as TitleBlockDef } from "./TitleBlock";
import UpcomingEventsBlock, {
	definition as UpcomingEventsBlockDef,
} from "./UpcomingEventsBlock";
import VideoBlock, {
	definition as VideoBlockDef,
} from "./VideoBlock/VideoBlock";

export const blockDefinitions: BlockDefinition[] = [
	TextBlockDef,
	TitleBlockDef,
	ImageBlockDef,
	SpacerBlockDef,
	ActionButtonBlockDef,
	FeatureBlockDef,
	HeroSectionBlockDef,
	UpcomingEventsBlockDef,
	PastEventsBlockDef,
	PostsListBlockDef,
	GroupsListBlockDef,
	DealsListBlockDef,
	SurveyFormBlockDef,
	CalloutBlockDef,
	QuoteBlockDef,
	VideoBlockDef,
	EmbedBlockDef,
	AccordionBlockDef,
];

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry, each block declares its own incompatible prop type
export const blockRegistry: Record<string, any> = {
	TextBlock,
	TitleBlock,
	ImageBlock,
	UpcomingEventsBlock,
	PastEventsBlock,
	PostsListBlock,
	SpacerBlock,
	FeatureBlock,
	ActionButtonBlock,
	HeroSectionBlock,
	GroupsListBlock,
	SurveyFormBlock,
	DealsListBlock,
	CalloutBlock,
	QuoteBlock,
	VideoBlock,
	EmbedBlock,
	AccordionBlock,
};
