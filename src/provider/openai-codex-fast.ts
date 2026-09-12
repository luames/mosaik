import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CODEX_FAST_SERVICE_TIER = "priority";

const PRELOAD_NAME = "openai-codex-fast-preload.js";
const INSTALLED = "__mosaikCodexFast";

export function isCodexResponsesRequest(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.model === "string" &&
    record.store === false &&
    record.stream === true &&
    Array.isArray(record.include) &&
    record.include.includes("reasoning.encrypted_content")
  );
}

export function applyCodexFastServiceTier<T>(value: T): T {
  if (!isCodexResponsesRequest(value) || value.service_tier !== undefined) return value;
  return { ...value, service_tier: CODEX_FAST_SERVICE_TIER };
}

export function installCodexFastServiceTier(): void {
  const original = JSON.stringify as (
    value: unknown,
    replacer?: unknown,
    space?: unknown,
  ) => string;
  if (Object.hasOwn(JSON.stringify, INSTALLED)) return;
  const patched = ((value: unknown, replacer?: unknown, space?: unknown) =>
    original(applyCodexFastServiceTier(value), replacer, space)) as typeof JSON.stringify;
  Object.defineProperty(patched, INSTALLED, { value: true });
  JSON.stringify = patched;
}

export function resolveCodexFastPreloadPath(): string | undefined {
  const path = join(dirname(fileURLToPath(import.meta.url)), PRELOAD_NAME);
  return existsSync(path) ? path : undefined;
}

export function withCodexFastNodeOptions(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.MOSAIK_CODEX_FAST === "0") return env;
  const preload = resolveCodexFastPreloadPath();
  if (preload === undefined) return env;
  const flag = `--import=${pathToFileURL(preload).href}`;
  const current = env.NODE_OPTIONS?.trim() ?? "";
  if (current.includes(PRELOAD_NAME)) return env;
  return {
    ...env,
    NODE_OPTIONS: current.length === 0 ? flag : `${current} ${flag}`,
  };
}
