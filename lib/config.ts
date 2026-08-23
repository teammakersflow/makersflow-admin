/**
 * Public runtime configuration.
 *
 * WHY DEFAULTS ARE HARDCODED HERE
 * -------------------------------
 * These are `NEXT_PUBLIC_*` values, which means Next.js compiles them into
 * the browser bundle at build time. They are therefore already public —
 * anyone can read them in DevTools on the deployed site. Committing them is
 * not a secret leak.
 *
 * The deployment platform (Dokploy) applies its Environment settings at
 * RUNTIME, not to `docker build`, so `NEXT_PUBLIC_*` build args arrive empty
 * and the site shipped with an unusable login page. Falling back to the
 * correct values here makes the build work regardless of how the platform
 * passes variables.
 *
 * An env var still wins when one is set, so local development and any other
 * environment can override these without touching the code.
 *
 * NOTE: the Google *client secret* is NOT here and must never be. Only the
 * client ID is needed, and it is public by design.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.makersflow.in";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "708273277845-odd56t5ma558pop3qh8avku9kvp4em9r.apps.googleusercontent.com";

export const S3_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
  "https://makersflow-media.s3.ap-south-1.amazonaws.com";
