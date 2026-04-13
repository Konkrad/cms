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

## Playwright login flow

The app uses magic-link + OTP email auth. To log in during playwright-cli testing:

1. Open the browser and go to `/login`
2. Fill the email input and submit
3. Use the mailpit JS SDK (`tests/utils/mailpit-client.ts`) to retrieve the email:
   ```bash
   playwright-cli eval "async () => { const res = await fetch('http://localhost:8025/api/v1/messages?limit=5'); const data = await res.json(); const msg = data.messages.find(m => m.To.some(r => r.Address === 'EMAIL')); if (!msg) return 'no email'; const summary = await fetch('http://localhost:8025/api/v1/message/' + msg.ID); const body = await summary.json(); const match = body.HTML.match(/>([A-Z0-9]{6})</i); return match ? match[1] : 'no code'; }"
   ```
4. Fill the 6-char OTP code into the verification input and submit
5. Alternatively, extract the magic link from the email and `playwright-cli goto <link>`

Mailpit API runs at `http://localhost:8025`. The `waitForEmailHtml()` and `extractAllLinks()` helpers in `tests/utils/mailpit-client.ts` can be used in e2e test files.

Before creating any UI element (button, input, modal, badge, alert, avatar, card, table, image upload), read src/design/DESIGN.md — all shared primitives are documented there with usage examples. Import from `~/components/ui`, never from individual component files.

## Image thumbnail convention

Every uploaded image has a thumbnail variant. The DB only stores the **main** image path. The thumbnail path is derived by convention:

```
{name}.webp → {name}-thumb.webp
```

Use `deriveThumbnailKey(mainPath)` from `~/utils/images` to get the thumbnail path. Never store thumbnail paths separately in the database — they are always computable from the main path.