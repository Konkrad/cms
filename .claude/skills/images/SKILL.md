---
name: images
description: Use when storing, displaying, uploading or presigning images or S3 objects (event/article/scope images, profile pictures, thumbnails), or when touching VITE_S3_BASE_URL, src/core/media, or the /api/images upload endpoint. Complements the S3 rules in CLAUDE.md Security.
---

# Images and S3

- Public images (events, articles, scope home pages under `public/scopes/`): store the S3 key in the DB; call `publicImageUrlFromKey(key)` from `~/core/media/images` (modules: from `~/core` or `~/core/ui`) to build a direct browser URL using `VITE_S3_BASE_URL`. Thumbnails are derived with `deriveThumbnailKey(key)`.
- Article featured images: uploaded by `ArticleForm` (`ImageUploader`, path `ARTICLE_IMAGE_PATH` = `public/articles`, cropped 1:1) and stored as the key in `articles.featured_image`. `articlesService` accepts only `public/articles/…` keys (plus `public/posts/…` of images migrated from posts; an unchanged key is kept), rejecting other prefixes, `..` and URLs (`isArticleImageKey`). Shown through `publicImageUrlFromKey` (cards, hero, article page, og:image/JSON-LD). Notes have no image.
- Profile pictures are split: the full-size image (`private/profile-pictures/`) is stored in `users.profilePicture` and must be presigned server-side via `resolvePrivateImageUrl(key)` from `~/core/media/secure-urls`; the thumbnail (`public/profile-pictures/`) is stored separately in `users.profilePictureSmall` and served as a direct public URL via `publicImageUrlFromKey`.
- `VITE_S3_BASE_URL` (e.g. `http://localhost:9000/data` locally, `https://<bucket>.s3.<region>.amazonaws.com` in prod) is the base URL for all public S3 objects. It is a Vite env var read via `import.meta.env.VITE_S3_BASE_URL`, not through `src/env.ts` (the one exception to the `src/env.ts` rule).
- Key validation and presign rules (prefix allowlists, `/api/images` upload authorization) are in CLAUDE.md Security § S3 key handling. The upload endpoint is `src/routes/api/images/index.ts`.
