/**
 * Block registry — maps a page builder `componentType` string to its themed
 * component. Core's `BlockRenderer` (src/components/builder/BlockRenderer.tsx)
 * dispatches through this map so a theme can add, remove, or replace block
 * types without touching core.
 *
 * Most blocks are pure presentational components (props from page data), but
 * several (DealsListBlock, GroupsListBlock, HeroSectionBlock,
 * LocalCommunitiesMapBlock, PastEventsBlock, UpcomingEventsBlock) are
 * self-contained: the page builder lets an editor drop them on any page, so
 * they fetch their own data server-side via `server$` rather than receiving it
 * from a route loader. That is an intentional exception to the "theme never
 * imports services" rule for routes — these blocks ARE the data-fetching unit
 * for builder-placed content, the same way a route loader is for a fixed route.
 */
import TextBlock from "./TextBlock";
import TitleBlock from "./TitleBlock";
import ImageBlock from "./ImageBlock";
import UpcomingEventsBlock from "./UpcomingEventsBlock";
import PastEventsBlock from "./PastEventsBlock";
import PostsListBlock from "./PostsListBlock";
import SpacerBlock from "./SpacerBlock";
import FeatureBlock from "./FeatureBlock";
import ActionButtonBlock from "./ActionButtonBlock";
import LocalCommunitiesMapBlock from "./LocalCommunitiesMapBlock";
import HeroSectionBlock from "./HeroSectionBlock";
import GroupsListBlock from "./GroupsListBlock";
import SurveyFormBlock from "./SurveyFormBlock";
import DealsListBlock from "./DealsListBlock";

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
  LocalCommunitiesMapBlock,
  HeroSectionBlock,
  GroupsListBlock,
  SurveyFormBlock,
  DealsListBlock,
};
