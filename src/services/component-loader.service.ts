import type { BlockDefinition } from "~/db/schema";
import { blockDefinitions, blockRegistry } from "~theme/blocks";

let definitionsCache: Map<string, BlockDefinition> | null = null;

export const componentLoaderService = {
  async getComponentDefinitions(): Promise<Map<string, BlockDefinition>> {
    if (definitionsCache) return definitionsCache;
    definitionsCache = new Map(
      blockDefinitions.map((def) => [def.componentType, def]),
    );
    return definitionsCache;
  },

  async getComponentDefinition(
    componentType: string,
  ): Promise<BlockDefinition | undefined> {
    const definitions = await this.getComponentDefinitions();
    return definitions.get(componentType);
  },

  async loadComponent(componentType: string): Promise<any> {
    const component = blockRegistry[componentType];
    if (!component) {
      throw new Error(`Component ${componentType} not found`);
    }
    return component;
  },

  getAvailableComponents(): string[] {
    return blockDefinitions.map((def) => def.componentType);
  },

  clearCache(): void {
    definitionsCache = null;
  },
};
