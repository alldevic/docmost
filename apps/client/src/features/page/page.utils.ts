import slugify from "slugify";

const buildPageSlug = (pageSlugId: string, pageTitle?: string): string => {
  const titleSlug = slugify(pageTitle?.substring(0, 70) || "untitled");

  return `p/${titleSlug}-${pageSlugId}`;
};

export const buildPageUrl = (
  spaceName: string,
  pageSlugId: string,
  pageTitle?: string,
): string => {
  if (spaceName === undefined) {
    return `/${buildPageSlug(pageSlugId, pageTitle)}`;
  }
  return `/s/${spaceName}/${buildPageSlug(pageSlugId, pageTitle)}`;
};
