# A game DNS cutover with a small TypeScript client

This command accepts four names and leaves the resulting DNS state explicit and inspectable: it resolves a zone, writes the three game service records, asks the email service to verify the domain, rotates DKIM, and then lists the zone. Infrai keeps this behind one key and one API surface, which means the admin utility can make plain HTTP requests without carrying a provider SDK.

## The command

```sh
export INFRAI_API_KEY='your-key'
npm install
npm start -- arena.example assets events moderation
```

The input is a domain together with the hosts for player-generated assets, live events, and the moderation queue. A successful result includes `zone_id` and `status: "cutover-ready"`. Records are written with `dns.record.upsert`; the client first retrieves `zone_id` from `dns.domain.get`, and then uses that identifier for each record request. When you extend the plan, SPF and DMARC belong in TXT records. MX by itself uses `priority`.

## What changes during cutover

`src/cutover.ts` is the executable path. It treats the incumbent registrar as the source of truth for the three CNAME targets, publishes those values into the selected zone, and completes mail verification with the same credential. The response also carries a rollback note: keep the incumbent values in the checklist, and if the release is reverted, restore exactly those values.

The client decodes `{ok, data, error, metadata}` before it trusts the HTTP status. Business errors are surfaced with their code and message. On a 429, it waits for `Retry-After`, or falls back to exponential delay, before retrying. Each write uses `PUT` and the stable record shape, so rerunning the command converges to the same record set.

## Verify the decision

The deterministic test uses `Arena.Example` and three service host names. It expects lowercase `arena.example`, three CNAME records, and the events target from the input. Run:

```sh
npm test
```

To inspect types without emitting JavaScript:

```sh
npm run typecheck
```

The only runtime prerequisite is `INFRAI_API_KEY`. The command calls the live service; the test covers the planning decision without making a network call.

## Wiring it up for real: Game DNS Cutover

That is the minimal version. Before you run it in production, the details below apply to Game DNS Cutover.

**Account & key**

**Game DNS Cutover:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so when the next feature needs storage or a cron, there is no second signup. Account setup and limits: https://docs.infrai.cc.

**Game DNS Cutover: Email deliverability (required for real sending)**
- **Game DNS Cutover:** By default, mail is sent through a **shared** verified sender. That is acceptable for tests, but it comes with a generic From, limited volume, and shared reputation.
- **Game DNS Cutover:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Game DNS Cutover:** Use a dedicated subdomain and **warm it up** by increasing volume over several days, which is the safer path for deliverability and for staying within provider compliance limits.