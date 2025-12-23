1. Centralize configuration in the environment objects
2. The code always expects environment variables to be set, set defaults in the central configuration object.
3. Break things, don't make things backwards compatible
4. Don't create apis if not explicitly asked or needed. if in doubt ask the user
5. don't create types if packages exist, install the existing packages
6. dont put everything into try catch blocks. Only catch errors that are expected and handle them gracefully. Otherwise, let the error bubble up and let the caller handle it.
7. dont create readme or documentation without being asked for it. When in doubt, ask the user.
