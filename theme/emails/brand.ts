/**
 * Email brand identity. Core's email templates (`src/emails/**`) import these
 * defaults for copy that would otherwise be hardcoded — site name, logo alt
 * text, footer copyright. The actual sending/rendering plumbing
 * (react-email, nodemailer) stays in core; only the branding strings live here.
 * 
 * Replace these values with your organization's branding.
 */
export const emailBrand = {
  siteName: "Community CMS",
  logoAlt: "Community Logo",
  footerCopyright: "Community CMS",
};
