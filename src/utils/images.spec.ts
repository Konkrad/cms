import { describe, it, expect } from "vitest";
import { deriveThumbnailKey, publicImageUrlFromKey } from "./images";

describe("deriveThumbnailKey", () => {
  it("appends -thumb before .webp extension", () => {
    expect(deriveThumbnailKey("public/events/abc.webp")).toBe(
      "public/events/abc-thumb.webp",
    );
  });

  it("works with nested paths", () => {
    expect(
      deriveThumbnailKey("private/events/123/photos/uuid-here.webp"),
    ).toBe("private/events/123/photos/uuid-here-thumb.webp");
  });

  it("works with profile picture keys", () => {
    expect(
      deriveThumbnailKey("public/profile-pictures/5113fa42.webp"),
    ).toBe("public/profile-pictures/5113fa42-thumb.webp");
  });

  it("does not modify non-webp extensions", () => {
    expect(deriveThumbnailKey("public/events/abc.png")).toBe(
      "public/events/abc.png",
    );
  });

  it("only replaces the trailing .webp", () => {
    expect(deriveThumbnailKey("public/events/file.webp.webp")).toBe(
      "public/events/file.webp-thumb.webp",
    );
  });

  it("handles keys without leading slash", () => {
    const key = "public/groups/img.webp";
    expect(deriveThumbnailKey(key)).toBe("public/groups/img-thumb.webp");
    expect(deriveThumbnailKey(key)).not.toContain("//");
  });
});

describe("publicImageUrlFromKey", () => {
  it("builds local middleware URL for a stored key", () => {
    expect(publicImageUrlFromKey("public/events/seed-1.webp")).toBe(
      "/api/images?key=public%2Fevents%2Fseed-1.webp",
    );
  });

  it("preserves already-built middleware URL", () => {
    expect(
      publicImageUrlFromKey("/api/images?key=public%2Fevents%2Fseed-1.webp"),
    ).toBe("/api/images?key=public%2Fevents%2Fseed-1.webp");
  });

  it("normalizes middleware URL without leading slash", () => {
    expect(
      publicImageUrlFromKey("api/images?key=public%2Fevents%2Fseed-1.webp"),
    ).toBe("/api/images?key=public%2Fevents%2Fseed-1.webp");
  });
});
