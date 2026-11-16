import assert from "node:assert/strict";
import { cutoverPlan } from "./cutover.ts";

const plan = cutoverPlan({ domain: "Arena.Example", playerAssetsHost: "assets", eventHost: "events", moderationHost: "moderation" });
assert.equal(plan.domain, "arena.example");
assert.deepEqual(plan.records.map((record) => record.record_type), ["CNAME", "CNAME", "CNAME"]);
assert.equal(plan.records[1].content, "events.incumbent.example");
console.log("cutover decision test passed");
