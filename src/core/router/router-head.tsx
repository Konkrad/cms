import { component$ } from "@qwik.dev/core";
import { useDocumentHead, useLocation } from "@qwik.dev/router";

/**
 * The RouterHead component is placed inside of the document `<head>` element.
 */
export const RouterHead = component$(() => {
	const head = useDocumentHead();
	const loc = useLocation();

	return (
		<>
			<title>{head.title}</title>

			<link rel="canonical" href={loc.url.href} />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<link rel="icon" type="image/svg+xml" href="/favicon.svg" />

			{head.meta.map((m) => (
				<meta key={m.key} {...m} />
			))}

			{head.links.map((l) => (
				<link key={l.key} {...l} />
			))}

			{/* Attributes come at the top level (`{ type, script }`) or, deprecated, in `props`. */}
			{head.styles.map(({ key, props, style, ...attrs }) => (
				<style
					key={key}
					{...attrs}
					{...props}
					{...(props?.dangerouslySetInnerHTML
						? {}
						: { dangerouslySetInnerHTML: style })}
				/>
			))}

			{head.scripts.map(({ key, props, script, ...attrs }) => (
				<script
					key={key}
					{...attrs}
					{...props}
					{...(props?.dangerouslySetInnerHTML
						? {}
						: { dangerouslySetInnerHTML: script })}
				/>
			))}
		</>
	);
});
