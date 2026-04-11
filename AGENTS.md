1. Centralize configuration in the environment objects
2. The code always expects environment variables to be set, set defaults in the central configuration object.
3. Break things, don't make things backwards compatible
4. Don't create apis if not explicitly asked or needed. if in doubt ask the user
5. don't create types if packages exist, install the existing packages
6. dont put everything into try catch blocks. Only catch errors that are expected and handle them gracefully. Otherwise, let the error bubble up and let the caller handle it.
7. dont create readme or documentation without being asked for it. When in doubt, ask the user.
8. don't create migration files, modify database directly or force update

React componets for visuals have to be self contained. Therefore in theory be portable web components. They contain both javscript and css in one folder.

Use the playwright to verify if things actually are working. If the user complains about an endpoint use it to verify. Check playwright-cli --help for available commands.

Before creating any UI element (button, input, modal, badge, alert, avatar, card, table, image upload), read src/design/DESIGN.md — all shared primitives are documented there with usage examples. Import from `~/components/ui`, never from individual component files.