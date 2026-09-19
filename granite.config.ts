import { defineConfig, type AppsInTossWebConfig } from "@apps-in-toss/web-framework/config";

type BuildEnvironment = Record<string, string | undefined>;

const LOCAL_ONLY_APP_NAME = "Orbit Slash (local)";
const LOCAL_ONLY_ICON_URL = "https://console.apps-in-toss.invalid/orbitslash-icon.png";

/**
 * The Apps in Toss Console remains the owner of the published app identity.
 * Local Vite/test commands get a non-deployable placeholder, while `AIT_BUILD=1`
 * refuses to build without the exact Console-managed name and icon URL.
 */
export function resolveAppsInTossGraniteConfig(env: BuildEnvironment): AppsInTossWebConfig {
  const isAitBuild = env.AIT_BUILD === "1";
  const appName = requiredConsoleValue(env, "APPS_IN_TOSS_APP_NAME", isAitBuild) ?? LOCAL_ONLY_APP_NAME;
  const iconUrl = requiredConsoleValue(env, "APPS_IN_TOSS_CONSOLE_ICON_URL", isAitBuild) ?? LOCAL_ONLY_ICON_URL;

  return {
    appName,
    brand: {
      displayName: appName,
      primaryColor: "#0B1020",
      icon: iconUrl,
    },
    permissions: [],
    navigationBar: {
      withBackButton: false,
      withHomeButton: true,
      withTitle: false,
      transparentBackground: true,
      theme: "dark",
    },
    web: {
      host: "localhost",
      port: 5173,
      commands: {
        dev: "npm run dev",
        build: "npm run build",
      },
    },
    outdir: "dist",
    webViewProps: {
      type: "game",
      bounces: false,
      pullToRefreshEnabled: false,
      overScrollMode: "never",
      mediaPlaybackRequiresUserAction: false,
    },
  };
}

export default defineConfig(resolveAppsInTossGraniteConfig(process.env));

function requiredConsoleValue(env: BuildEnvironment, name: "APPS_IN_TOSS_APP_NAME" | "APPS_IN_TOSS_CONSOLE_ICON_URL", required: boolean): string | undefined {
  const value = env[name]?.trim();
  if (value) return value;
  if (required) throw new Error(`AIT_BUILD=1 requires ${name} from the Apps in Toss Console.`);
  return undefined;
}
