/**
 * Block registry — the single source of truth for the page builder.
 *
 * `blockRegistry` is used by core's BlockRenderer to render blocks at runtime.
 * `blockDefinitions` is consumed by component-loader.service.ts to drive the
 * admin picker — so adding or removing a block here is the only change needed.
 *
 * Several blocks (DealsListBlock, GroupsListBlock, HeroSectionBlock,
 * PastEventsBlock, UpcomingEventsBlock) are self-contained data-fetchers that
 * use `server$` — an intentional exception to the "theme never imports
 * services" rule, since the page builder has no route loader to supply them.
 */
import type { BlockDefinition } from "~/db/schema";
import TextBlock, { definition as TextBlockDef } from "./TextBlock";
import TitleBlock, { definition as TitleBlockDef } from "./TitleBlock";
import ImageBlock, { definition as ImageBlockDef } from "./ImageBlock";
import UpcomingEventsBlock, { definition as UpcomingEventsBlockDef } from "./UpcomingEventsBlock";
import PastEventsBlock, { definition as PastEventsBlockDef } from "./PastEventsBlock";
import PostsListBlock, { definition as PostsListBlockDef } from "./PostsListBlock";
import SpacerBlock, { definition as SpacerBlockDef } from "./SpacerBlock";
import FeatureBlock, { definition as FeatureBlockDef } from "./FeatureBlock";
import ActionButtonBlock, { definition as ActionButtonBlockDef } from "./ActionButtonBlock";
import HeroSectionBlock, { definition as HeroSectionBlockDef } from "./HeroSectionBlock";
import GroupsListBlock, { definition as GroupsListBlockDef } from "./GroupsListBlock";
import SurveyFormBlock, { definition as SurveyFormBlockDef } from "./SurveyFormBlock";
import DealsListBlock, { definition as DealsListBlockDef } from "./DealsListBlock";
import CalloutBlock, { definition as CalloutBlockDef } from "./CalloutBlock/CalloutBlock";
import QuoteBlock, { definition as QuoteBlockDef } from "./QuoteBlock/QuoteBlock";
import VideoBlock, { definition as VideoBlockDef } from "./VideoBlock/VideoBlock";
import EmbedBlock, { definition as EmbedBlockDef } from "./EmbedBlock/EmbedBlock";
import AccordionBlock, { definition as AccordionBlockDef } from "./AccordionBlock/AccordionBlock";

export const blockDefinitions: BlockDefinition[] = [
  TextBlockDef, TitleBlockDef, ImageBlockDef, SpacerBlockDef,
  ActionButtonBlockDef, FeatureBlockDef, HeroSectionBlockDef,
  UpcomingEventsBlockDef, PastEventsBlockDef, PostsListBlockDef,
  GroupsListBlockDef, DealsListBlockDef, SurveyFormBlockDef,
  CalloutBlockDef, QuoteBlockDef, VideoBlockDef, EmbedBlockDef, AccordionBlockDef,
];

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
