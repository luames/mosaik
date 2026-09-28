import assert from "node:assert/strict";
import { test } from "vitest";
import {
  CODEX_FAST_SERVICE_TIER,
  applyCodexFastServiceTier,
  installCodexFastServiceTier,
  isCodexResponsesRequest,
  withCodexFastNodeOptions,
} from "../openai-codex-fast.js";

const codexBody = {
  model: "gpt-5.6-luna",
  store: false as const,
  stream: true as const,
  include: ["reasoning.encrypted_content"],
  input: [],
};

test("identifies Codex Responses request bodies", () => {
  assert.equal(isCodexResponsesRequest(codexBody), true);
  assert.equal(isCodexResponsesRequest({ hello: "world" }), false);
  assert.equal(isCodexResponsesRequest({ type: "response.create", ...codexBody }), true);
});

test("adds Fast mode when Codex request bodies omit service_tier", () => {
  assert.deepEqual(applyCodexFastServiceTier(codexBody), {
    ...codexBody,
    service_tier: CODEX_FAST_SERVICE_TIER,
  });
  assert.deepEqual(applyCodexFastServiceTier({ hello: "world" }), { hello: "world" });
  assert.deepEqual(applyCodexFastServiceTier({ ...codexBody, service_tier: "flex" }), {
    ...codexBody,
    service_tier: "flex",
  });
});

test("JSON.stringify hook injects Fast mode only into Codex request bodies", () => {
  const original = JSON.stringify;
  try {
    installCodexFastServiceTier();
    assert.equal(JSON.parse(JSON.stringify(codexBody)).service_tier, CODEX_FAST_SERVICE_TIER);
    assert.equal(JSON.stringify({ hello: "world" }), '{"hello":"world"}');
  } finally {
    JSON.stringify = original;
  }
});

test("MOSAIK_CODEX_FAST=0 leaves NODE_OPTIONS unchanged", () => {
  assert.deepEqual(
    withCodexFastNodeOptions({ MOSAIK_CODEX_FAST: "0", NODE_OPTIONS: "--trace-exit" }),
    {
      MOSAIK_CODEX_FAST: "0",
      NODE_OPTIONS: "--trace-exit",
    },
  );
});
