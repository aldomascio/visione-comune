export type BaseEnv = {
  appName: string;
  appUrl: string;
};

type EnvSource = Record<string, string | undefined>;

export function readBaseEnv(source: EnvSource = process.env): BaseEnv {
  return {
    appName: readOptionalEnv(source, "NEXT_PUBLIC_APP_NAME", "Visione Comune"),
    appUrl: readOptionalEnv(source, "NEXT_PUBLIC_APP_URL", "http://localhost:3000")
  };
}

function readOptionalEnv(
  source: EnvSource,
  key: string,
  fallback: string
): string {
  const value = source[key]?.trim();

  return value && value.length > 0 ? value : fallback;
}
