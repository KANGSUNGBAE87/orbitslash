export const RELEASE_TARGET_PLAN = {
  currentImplementationTarget: "local_web_playable",
  firstPublicReleasePrepTarget: "google_play",
  appsInTossCompatibility: true,
  actualPublishingRequiresOwnerCommand: true,
} as const;

export type ReleaseTargetPlan = typeof RELEASE_TARGET_PLAN;
