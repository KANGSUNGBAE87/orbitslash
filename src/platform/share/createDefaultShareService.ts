import { createAppsInTossSharePort } from "../apps-in-toss/AppsInTossShare";
import { createBrowserShareRuntime, ShareService } from "./ShareService";

/** Platform composition stays outside game logic and the shared fallback policy. */
export function createDefaultShareService(): ShareService {
  return new ShareService({
    ...createBrowserShareRuntime(),
    appsInToss: createAppsInTossSharePort(),
  });
}
