#!/usr/bin/env node

/**
 * Script to update theme imports from static to dynamic
 * This converts imports like:
 *   import { SomeView } from "~theme/routes/.../SomeView";
 * To:
 *   import { useThemeComponent$ } from "~/utils/theme-loader";
 *   import type { FC } from "react";
 *   ...
 *   const SomeView = useThemeComponent$<FC<{ ... }>>(() => import("~theme/routes/.../SomeView"));
 *   return SomeView.value && <SomeView.value ... />;
 */

import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src/routes/auth/verify/index.tsx',
  'src/routes/deals/[id]/index.tsx',
  'src/routes/elections/[id]/apply/index.tsx',
  'src/routes/elections/[id]/index.tsx',
  'src/routes/elections/index.tsx',
  'src/routes/elections/mine/index.tsx',
  'src/routes/events/[id]/checkout/index.tsx',
  'src/routes/events/[id]/index.tsx',
  'src/routes/events/[id]/photos/index.tsx',
  'src/routes/forms/[formSlug]/index.tsx',
  'src/routes/groups/[slug]/index.tsx',
  'src/routes/jobs/[id]/index.tsx',
  'src/routes/jobs/index.tsx',
  'src/routes/jobs/mine/[id]/edit/index.tsx',
  'src/routes/jobs/mine/index.tsx',
  'src/routes/jobs/new/index.tsx',
  'src/routes/profile/edit/index.tsx',
  'src/routes/profile/setup/index.tsx',
  'src/routes/profile/tickets/index.tsx',
  'src/routes/qualifications/verify/[token]/index.tsx',
  'src/routes/users/[userId]/index.tsx',
];

for (const file of files) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Match the theme import
  const themeImportMatch = content.match(/^import\s+\{?\s*(\w+)\s*\}?\s+from\s+["']~theme\/[^"']+["']\s*;/m);

  if (!themeImportMatch) {
    console.warn(`No theme import found in: ${file}`);
    continue;
  }

  const componentName = themeImportMatch[1];
  const themeImportLine = themeImportMatch[0];

  // Add new imports
  const newImports = `import { useThemeComponent$ } from "~/utils/theme-loader";
import type { FC } from "react";`;

  // Replace the import line
  content = content.replace(themeImportLine, newImports);

  // Find the default component and update it
  // Pattern: export default component$(() => { ... return <ComponentName ... />; });
  const componentPattern = /(export default component\$\(() => \{[\s\S]*?)(<)(\w+)(\s+[^>]*?>);/;
  const match = content.match(componentPattern);

  if (!match) {
    console.warn(`Could not find component pattern in: ${file}`);
    continue;
  }

  const before = match[1];
  const after = match[4];

  // Create the dynamic import
  const dynamicImport = `  const ${componentName} = useThemeComponent$<FC<{ [key: string]: any }>>(
    () => import("~theme/${extractThemePath(themeImportLine)}")
  );

  return ${componentName}.value && <${componentName}.value`;

  const updatedComponent = before + dynamicImport + after;

  content = content.replace(match[0], updatedComponent);

  fs.writeFileSync(filePath, content);
  console.log(`Updated: ${file}`);
}

function extractThemePath(importLine) {
  // Extract the path from: import { X } from "~theme/.../X";
  const match = importLine.match(/from\s+["']~theme\/([^"']+)["']/);
  return match ? match[1] : '';
}
