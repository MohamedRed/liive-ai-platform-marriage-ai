// Firebase Functions entrypoint.
// Keep this repo scoped to the domains that actually exist in this codebase;
// stale cross-product exports make the production build fail and can deploy
// functions with missing handlers.
export * from './main';
