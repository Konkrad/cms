import type { BlockDefinition } from "~/db/schema";

const componentModules = {
	HeroBlock: () => import("~/components/page-blocks/HeroBlock"),
	TextBlock: () => import("~/components/page-blocks/TextBlock"),
	ImageBlock: () => import("~/components/page-blocks/ImageBlock"),
	EventsListBlock: () => import("~/components/page-blocks/EventsListBlock"),
	PostsListBlock: () => import("~/components/page-blocks/PostsListBlock"),
	SpacerBlock: () => import("~/components/page-blocks/SpacerBlock"),
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
