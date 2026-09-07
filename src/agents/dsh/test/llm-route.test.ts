import assert from "node:assert/strict";
import { test } from "vitest";
import { DISCOVERY_PROFILE } from "../discovery-profile.js";
import {
  DEFAULT_LLM_MODEL,
  applyLlmRoute,
  availableLlmChoices,
  formatLlmChoicesDetail,
  formatLlmRouteLabel,
  llmChoiceNumber,
  llmModelFlag,
  matchLlmChoices,
  patchDshProfile,
  resolveConfiguredLlmRoute,
  resolveLlmRoute,
  resolvePickedLlmModel,
} from "../llm-route.js";

test("resolveLlmRoute keeps OpenRouter models and maps Codex catalog ids", () => {
  assert.deepEqual(resolveLlmRoute(), {
    provider: "openrouter",
    model: DEFAULT_LLM_MODEL,
  });
  assert.deepEqual(resolveLlmRoute("openai/gpt-5.6-luna:nitro"), {
    provider: "openrouter",
    model: "openai/gpt-5.6-luna:nitro",
  });
  assert.deepEqual(resolveLlmRoute("gpt-5.6-luna"), {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
  });
  assert.deepEqual(resolveLlmRoute("luna"), {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
  });
  assert.deepEqual(resolveLlmRoute("openai-codex/gpt-5.6-luna"), {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
  });
  assert.throws(() => resolveLlmRoute("openai-codex/gpt-5.3-codex-spark"), /only gpt-5\.6-luna/);
});

test("configured routes keep an explicit provider and format Codex flags", () => {
  assert.deepEqual(resolveConfiguredLlmRoute({ model: "gpt-5.6-luna" }), {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
  });
  assert.deepEqual(resolveConfiguredLlmRoute({ provider: "openai-codex", model: "gpt-5.6-luna" }), {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
  });
  assert.throws(
    () => resolveConfiguredLlmRoute({ provider: "openai-codex", model: "gpt-5.3-codex-spark" }),
    /only gpt-5\.6-luna/,
  );
  assert.deepEqual(
    resolveConfiguredLlmRoute({
      provider: "openrouter",
      model: "openai/gpt-5.6-luna:nitro",
    }),
    { provider: "openrouter", model: "openai/gpt-5.6-luna:nitro" },
  );
  assert.equal(
    llmModelFlag({ provider: "openai-codex", model: "gpt-5.6-luna" }),
    "openai-codex/gpt-5.6-luna",
  );
  assert.equal(
    llmModelFlag({ provider: "openrouter", model: "openai/gpt-5.6-luna:nitro" }),
    "openai/gpt-5.6-luna:nitro",
  );
  assert.equal(formatLlmRouteLabel("gpt-5.6-luna"), "openai-codex · gpt-5.6-luna");
  assert.equal(
    formatLlmRouteLabel("openai/gpt-5.6-luna:nitro"),
    "openrouter · openai/gpt-5.6-luna:nitro",
  );
});

test("available models can be listed and picked by number or unique filter", () => {
  const choices = availableLlmChoices();
  assert.equal(choices[0]?.provider, "openrouter");
  assert.equal(choices[1]?.model, "gpt-5.6-luna");
  assert.equal(llmChoiceNumber(choices[1]!), 2);
  assert.equal(resolvePickedLlmModel("2"), "openai-codex/gpt-5.6-luna");
  assert.equal(resolvePickedLlmModel("codex"), "openai-codex/gpt-5.6-luna");
  assert.equal(matchLlmChoices("luna").length, 2);
  assert.throws(() => resolvePickedLlmModel("luna"), /↑\/↓ to pick/);
  assert.match(formatLlmChoicesDetail("gpt-5.6-luna"), /2  openai-codex  gpt-5\.6-luna  current/);
});

test("applyLlmRoute switches the DSH default provider for Codex Luna", () => {
  const profile = applyLlmRoute(DISCOVERY_PROFILE, "gpt-5.6-luna");
  assert.match(profile, /provider: openai-codex/);
  assert.match(profile, /model: gpt-5\.6-luna/);
  assert.match(profile, /openai-codex:\n        reasoning: high/);
  assert.doesNotMatch(profile, /^    provider: openrouter$/m);
  assert.match(profile, /apiKeyEnv: OPENROUTER_API_KEY/);
});

test("patchDshProfile updates reasoning on every provider block", () => {
  const profile = patchDshProfile(DISCOVERY_PROFILE, {
    model: "luna",
    reasoning: "low",
    plugin: "/tmp/plugin.js",
    persona: "      Test persona",
  });
  assert.match(profile, /provider: openai-codex/);
  assert.match(profile, /model: gpt-5\.6-luna/);
  assert.equal(profile.includes("        reasoning: high"), false);
  assert.match(profile, /reasoning: low/);
  assert.match(profile, /"\/tmp\/plugin\.js"/);
  assert.match(profile, /Test persona/);
});
