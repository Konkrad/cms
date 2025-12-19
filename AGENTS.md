1. Centralize configuration in the environment objects
2. The code always expects environment variables to be set, set defaults in the central configuration object.
3. Break things, don't make things backwards compatible
4. Don't create apis if not explicitly asked or needed. if in doubt ask the user
