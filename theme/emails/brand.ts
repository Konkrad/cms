/**
 * Email brand identity. Core's email templates (`src/emails/**`) import these
 * defaults for copy that would otherwise be hardcoded — site name, logo alt
 * text, footer copyright. The actual sending/rendering plumbing
 * (react-email, nodemailer) stays in core; only the branding strings live here.
 */
export const emailBrand = {
  siteName: "Community Management System",
  logoAlt: "Community Management System Logo",
  footerCopyright: "Community Management System",
};
