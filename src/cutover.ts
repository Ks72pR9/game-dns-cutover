import { InfraiDns, recordBody } from "./infrai_dns.ts";

export type GameCutover = { domain: string; playerAssetsHost: string; eventHost: string; moderationHost: string };

export function cutoverPlan(input: GameCutover) {
  const domain = input.domain.trim().toLowerCase();
  if (!domain || !input.playerAssetsHost || !input.eventHost || !input.moderationHost) throw new Error("domain and service hosts are required");
  return { domain, records: [
    { record_type: "CNAME" as const, name: input.playerAssetsHost, content: "assets.incumbent.example" },
    { record_type: "CNAME" as const, name: input.eventHost, content: "events.incumbent.example" },
    { record_type: "CNAME" as const, name: input.moderationHost, content: "moderation.incumbent.example" }
  ] };
}

export async function runCutover(input: GameCutover, client = new InfraiDns(process.env.INFRAI_API_KEY ?? "")) {
  const plan = cutoverPlan(input);
  // Resolve and validate the zone before performing any persistent operation.
  const zone = await client.domainGet(plan.domain);
  if (!zone.zone_id?.trim()) throw new Error("domain has no usable zone_id");
  for (const record of plan.records) await client.recordUpsert(recordBody.parse({ zone_id: zone.zone_id, ...record }));
  await client.emailDomainVerify(plan.domain);
  await client.emailDomainRotateDkim(plan.domain);
  await client.recordList(zone.zone_id);
  return { domain: plan.domain, zone_id: zone.zone_id, status: "cutover-ready", rollback: "restore the incumbent DNS values from the checklist" };
}

if (process.argv[1]?.endsWith("cutover.ts")) {
  const [domain, playerAssetsHost, eventHost, moderationHost] = process.argv.slice(2);
  if (!domain || !playerAssetsHost || !eventHost || !moderationHost) throw new Error("usage: npm start -- DOMAIN ASSETS EVENTS MODERATION");
  console.log(await runCutover({ domain, playerAssetsHost, eventHost, moderationHost }));
}
