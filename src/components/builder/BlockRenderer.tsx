import { component$ } from "@qwik.dev/core";
import type { BlockData } from "~/db/schema";
import TextBlock from "~/components/page-blocks/TextBlock";
import TitleBlock from "~/components/page-blocks/TitleBlock";
import ImageBlock from "~/components/page-blocks/ImageBlock";
import UpcomingEventsBlock from "~/components/page-blocks/UpcomingEventsBlock";
import PastEventsBlock from "~/components/page-blocks/PastEventsBlock";
import PostsListBlock from "~/components/page-blocks/PostsListBlock";
import SpacerBlock from "~/components/page-blocks/SpacerBlock";
import FeatureBlock from "~/components/page-blocks/FeatureBlock";
import ActionButtonBlock from "~/components/page-blocks/ActionButtonBlock";
import LocalCommunitiesMapBlock from "~/components/page-blocks/LocalCommunitiesMapBlock";
import HeroSectionBlock from "~/components/page-blocks/HeroSectionBlock";
import GroupsListBlock from "~/components/page-blocks/GroupsListBlock";
import SurveyFormBlock from "~/components/page-blocks/SurveyFormBlock";

interface BlockRendererProps {
  block: BlockData;
}

const RUNTIME_COMPONENTS: Record<string, any> = {
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
};

export const BlockRenderer = component$<BlockRendererProps>((props) => {
  const BlockComponent = RUNTIME_COMPONENTS[props.block.componentType];

  if (!BlockComponent) {
    return (
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
        Failed to load component: {props.block.componentType}
      </div>
    );
  }

  return <BlockComponent {...props.block.data} />;
});
