export const DEFAULT_LLM_MODEL = "openai/gpt-5.6-luna:nitro";

export const OPENAI_CODEX_MODEL = "gpt-5.6-luna";

export const OPENAI_CODEX_MODELS = [OPENAI_CODEX_MODEL] as const;

const OPENAI_CODEX_ALIASES: Record<string, string> = {
  luna: OPENAI_CODEX_MODEL,
};

function requireCodexModel(id: string): string {
  const model = OPENAI_CODEX_ALIASES[id] ?? id;
  if (!(OPENAI_CODEX_MODELS as readonly string[]).includes(model)) {
    throw new Error("Codex currently allows only gpt-5.6-luna");
  }
  return model;
}

export type LlmProvider = "openrouter" | "openai-codex";

export interface LlmRoute {
  provider: LlmProvider;
  model: string;
}

export function resolveLlmRoute(model = DEFAULT_LLM_MODEL): LlmRoute {
  const trimmed = model.trim();
  if (trimmed.length === 0) throw new Error("A model id is required");
  const separator = trimmed.indexOf("/");
  if (separator > 0) {
    const provider = trimmed.slice(0, separator);
    const id = trimmed.slice(separator + 1);
    if (id.trim().length === 0) throw new Error(`Model id is missing after "${provider}/"`);
    if (provider === "openai-codex") {
      return { provider, model: requireCodexModel(id) };
    }
    return { provider: "openrouter", model: trimmed };
  }
  const id = OPENAI_CODEX_ALIASES[trimmed] ?? trimmed;
  if ((OPENAI_CODEX_MODELS as readonly string[]).includes(id)) {
    return { provider: "openai-codex", model: id };
  }
  return { provider: "openrouter", model: trimmed };
}

export function parseLlmProvider(value: string): LlmProvider {
  if (value === "openrouter" || value === "openai-codex") return value;
  throw new Error("provider must be openrouter or openai-codex");
}

export function resolveConfiguredLlmRoute(config: {
  provider?: string;
  model?: string;
}): LlmRoute | undefined {
  if (config.model === undefined) return undefined;
  if (config.provider === undefined) return resolveLlmRoute(config.model);
  const provider = parseLlmProvider(config.provider);
  if (provider === "openai-codex") {
    return { provider, model: requireCodexModel(config.model) };
  }
  return { provider, model: config.model };
}

export function llmModelFlag(route: LlmRoute): string {
  return route.provider === "openai-codex" ? `${route.provider}/${route.model}` : route.model;
}

export function formatLlmRouteLabel(model: string): string {
  const route = resolveLlmRoute(model);
  return `${route.provider} · ${route.model}`;
}

export function availableLlmChoices(): LlmRoute[] {
  return [
    resolveLlmRoute(DEFAULT_LLM_MODEL),
    ...OPENAI_CODEX_MODELS.map((model) => ({ provider: "openai-codex" as const, model })),
  ];
}

export function matchLlmChoices(query: string): LlmRoute[] {
  const choices = availableLlmChoices();
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return choices;
  if (/^\d+$/.test(needle)) {
    const choice = choices[Number(needle) - 1];
    return choice === undefined ? [] : [choice];
  }
  return choices.filter((choice) => llmChoiceHaystack(choice).includes(needle));
}

export function resolvePickedLlmModel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("A model id is required");
  const matches = matchLlmChoices(trimmed);
  if (/^\d+$/.test(trimmed)) {
    if (matches[0] === undefined) {
      throw new Error(`Unknown model ${trimmed}. Type /model to list choices.`);
    }
    return llmModelFlag(matches[0]);
  }
  if (matches.length === 1) return llmModelFlag(matches[0]!);
  if (matches.length > 1) {
    throw new Error(`"${trimmed}" matches more than one model. Use ↑/↓ to pick.`);
  }
  return llmModelFlag(resolveLlmRoute(trimmed));
}

export function llmChoiceNumber(choice: LlmRoute): number {
  const flag = llmModelFlag(choice);
  return availableLlmChoices().findIndex((item) => llmModelFlag(item) === flag) + 1;
}

export function formatLlmChoicesDetail(current: string): string {
  const currentFlag = llmModelFlag(resolveLlmRoute(current));
  return availableLlmChoices()
    .map((choice) => {
      const flag = llmModelFlag(choice);
      const marker = flag === currentFlag ? "  current" : "";
      return `${llmChoiceNumber(choice)}  ${choice.provider}  ${choice.model}${marker}`;
    })
    .join("\n");
}

function llmChoiceHaystack(choice: LlmRoute): string {
  return `${choice.provider} ${choice.model} ${llmModelFlag(choice)}`.toLowerCase();
}

export function applyLlmRoute(profile: string, model: string): string {
  const route = resolveLlmRoute(model);
  return profile
    .replace(/^    provider: openrouter$/m, `    provider: ${route.provider}`)
    .replace(
      new RegExp(`^    model: ${DEFAULT_LLM_MODEL.replaceAll("/", "\\/")}$`, "m"),
      `    model: ${route.model}`,
    );
}

export function patchDshProfile(
  template: string,
  options: {
    model: string;
    reasoning: string;
    plugin?: string;
    persona?: string;
  },
): string {
  let profile = applyLlmRoute(template, options.model);
  if (options.plugin !== undefined) {
    profile = profile.replace("__DSH_DISCOVERY_PLUGIN__", JSON.stringify(options.plugin));
  }
  profile = profile.replaceAll(
    "        reasoning: high",
    `        reasoning: ${options.reasoning}`,
  );
  profile = profile.replaceAll("        reasoning: low", `        reasoning: ${options.reasoning}`);
  if (options.persona !== undefined) {
    profile = profile.replace(
      /      You discover a browser automation[\s\S]*?      After finishDiscovery returns discovered, STOP\./,
      options.persona,
    );
  }
  return profile;
}
