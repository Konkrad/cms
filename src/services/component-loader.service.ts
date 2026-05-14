import type { BlockDefinition } from "~/db/schema";

const componentModules = {
  TextBlock: () => import("~/components/page-blocks/TextBlock"),
  TitleBlock: () => import("~/components/page-blocks/TitleBlock"),
  ImageBlock: () => import("~/components/page-blocks/ImageBlock"),
  UpcomingEventsBlock: () =>
    import("~/components/page-blocks/UpcomingEventsBlock"),
  PastEventsBlock: () => import("~/components/page-blocks/PastEventsBlock"),
  PostsListBlock: () => import("~/components/page-blocks/PostsListBlock"),
  SpacerBlock: () => import("~/components/page-blocks/SpacerBlock"),
  FeatureBlock: () => import("~/components/page-blocks/FeatureBlock"),
  ActionButtonBlock: () => import("~/components/page-blocks/ActionButtonBlock"),
  LocalCommunitiesMapBlock: () =>
    import("~/components/page-blocks/LocalCommunitiesMapBlock"),
  HeroSectionBlock: () => import("~/components/page-blocks/HeroSectionBlock"),
  GroupsListBlock: () => import("~/components/page-blocks/GroupsListBlock"),
  SurveyFormBlock: () => import("~/components/page-blocks/SurveyFormBlock"),
  DealsListBlock: () => import("~/components/page-blocks/DealsListBlock"),
};

type ComponentModuleLoader = () => Promise<{
  default: any;
  definition: BlockDefinition;
}>;

let definitionsCache: Map<string, BlockDefinition> | null = null;

export const componentLoaderService = {
  async getComponentDefinitions(): Promise<Map<string, BlockDefinition>> {
    if (definitionsCache) {
      return definitionsCache;
    }

    const definitions = new Map<string, BlockDefinition>();

    for (const [componentType, loader] of Object.entries(componentModules)) {
      try {
        const module = await (loader as ComponentModuleLoader)();
        if (module.definition) {
          definitions.set(componentType, module.definition);
        }
      } catch (error) {
        console.error(`Failed to load component ${componentType}:`, error);
      }
    }

    definitionsCache = definitions;
    return definitions;
  },

  async getComponentDefinition(
    componentType: string,
  ): Promise<BlockDefinition | undefined> {
    const definitions = await this.getComponentDefinitions();
    return definitions.get(componentType);
  },

  async loadComponent(componentType: string): Promise<any> {
    const loader =
      componentModules[componentType as keyof typeof componentModules];
    if (!loader) {
      throw new Error(`Component ${componentType} not found`);
    }

    const module = await (loader as ComponentModuleLoader)();
    return module.default;
  },

  getAvailableComponents(): string[] {
    return Object.keys(componentModules);
  },

  clearCache(): void {
    definitionsCache = null;
  },
};
