/**
 * promote_anchors stage opt-out(MEMENTO_AUTO_PROMOTE_ANCHORS) 단위 테스트
 *
 * 작성일: 2026-09-10
 *
 * env 파싱 규칙(기본 true, "false"만 비활성)과 stage 함수가
 * 비활성 시 UPDATE 없이 status="skipped"를 반환하는지 검증한다.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { MEMORY_CONFIG } from "../../config/memory.js";
import { MemoryConsolidator } from "../../lib/memory/consolidate/MemoryConsolidator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** 서브프로세스에서 env를 설정한 뒤 config를 새로 로드하여 autoPromoteAnchors 값을 반환한다. */
function loadAutoPromote(envValue) {
  const env = { ...process.env };
  delete env.MEMENTO_AUTO_PROMOTE_ANCHORS;
  if (envValue !== undefined) env.MEMENTO_AUTO_PROMOTE_ANCHORS = envValue;
  const out = execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    `import { MEMORY_CONFIG } from "${path.join(ROOT, "config", "memory.js")}";` +
    "console.log(MEMORY_CONFIG.consolidate.autoPromoteAnchors);"
  ], { env, encoding: "utf8" });
  return out.trim() === "true";
}

/** stage 목록에서 promote_anchors 항목을 찾는다. */
function promoteStage(consolidator) {
  const stages = consolidator._enrichmentStages({}, {});
  const stage = stages.find((s) => s.name === "promote_anchors");
  assert.ok(stage, "promote_anchors stage 가 없다");
  return stage;
}

describe("MEMENTO_AUTO_PROMOTE_ANCHORS env 파싱", () => {
  it("미설정 시 기본 true (upstream 동작 유지)", () => {
    assert.equal(loadAutoPromote(undefined), true);
  });
  it("\"false\" 이면 비활성", () => {
    assert.equal(loadAutoPromote("false"), false);
  });
  it("\"true\" 이면 활성", () => {
    assert.equal(loadAutoPromote("true"), true);
  });
  it("그 외 문자열은 비활성으로 취급하지 않는다 (엄격 \"false\" 만)", () => {
    // 기존 enableRiskyStages 와 동일한 === "true" 계약: "false" 외 값은 false 가 된다.
    assert.equal(loadAutoPromote("0"), false);
  });
});

describe("promote_anchors stage opt-out", () => {
  it("autoPromoteAnchors=false 이면 _promoteAnchors 를 호출하지 않고 skipped 를 반환한다", async () => {
    const prev = MEMORY_CONFIG.consolidate.autoPromoteAnchors;
    MEMORY_CONFIG.consolidate.autoPromoteAnchors = false;
    try {
      const c = Object.create(MemoryConsolidator.prototype);
      let called = 0;
      c._promoteAnchors = async () => { called += 1; return 99; };
      const result = await promoteStage(c).fn();
      assert.deepEqual(result, { status: "skipped", affected: 0 });
      assert.equal(called, 0);
    } finally {
      MEMORY_CONFIG.consolidate.autoPromoteAnchors = prev;
    }
  });

  it("autoPromoteAnchors=true 이면 _promoteAnchors 결과를 그대로 돌려준다", async () => {
    const prev = MEMORY_CONFIG.consolidate.autoPromoteAnchors;
    MEMORY_CONFIG.consolidate.autoPromoteAnchors = true;
    try {
      const c = Object.create(MemoryConsolidator.prototype);
      let called = 0;
      c._promoteAnchors = async () => { called += 1; return 7; };
      const result = await promoteStage(c).fn();
      assert.equal(result, 7);
      assert.equal(called, 1);
    } finally {
      MEMORY_CONFIG.consolidate.autoPromoteAnchors = prev;
    }
  });
});
