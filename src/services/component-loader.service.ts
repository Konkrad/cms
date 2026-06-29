import type { BlockDefinition } from "~/db/schema";

const componentModules = {
  TextBlock: () => import("~theme/blocks/TextBlock"),
  TitleBlock: () => import("~theme/blocks/TitleBlock"),
  ImageBlock: () => import("~theme/blocks/ImageBlock"),
  UpcomingEventsBlock: () => import("~theme/blocks/UpcomingEventsBlock"),
  PastEventsBlock: () => import("~theme/blocks/PastEventsBlock"),
  PostsListBlock: () => import("~theme/blocks/PostsListBlock"),
  SpacerBlock: () => import("~theme/blocks/SpacerBlock"),
  FeatureBlock: () => import("~theme/blocks/FeatureBlock"),
  ActionButtonBlock: () => import("~theme/blocks/ActionButtonBlock"),
  LocalCommunitiesMapBlock: () =>
    import("~theme/blocks/LocalCommunitiesMapBlock"),
  HeroSectionBlock: () => import("~theme/blocks/HeroSectionBlock"),
  GroupsListBlock: () => import("~theme/blocks/GroupsListBlock"),
  SurveyFormBlock: () => import("~theme/blocks/SurveyFormBlock"),
  DealsListBlock: () => import("~theme/blocks/DealsListBlock"),
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
