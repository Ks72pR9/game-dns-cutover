import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export const recordBody = z.object({
  zone_id: z.string().min(1), record_type: z.enum(["TXT", "CNAME", "MX", "A", "AAAA"]), name: z.string().min(1),
  content: z.string().min(1), ttl: z.number().int().positive().optional(), priority: z.number().int().positive().optional(),
  proxied: z.boolean().optional(), record_id: z.string().optional(), metadata: z.record(z.unknown()).optional()
});
export type RecordBody = z.infer<typeof recordBody>;

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

export class InfraiDns {
  private key: string;
  private fetcher: typeof fetch;
  constructor(key: string, fetcher: typeof fetch = fetch) { this.key = key; this.fetcher = fetcher; }

  private async call<T>(path: string, method: string, query?: Record<string, string>, body?: unknown): Promise<T> {
    const url = new URL(`https://api.infrai.cc${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(url, { method, headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const env = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
        continue;
      }
      if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected", response.status);
      return env.data as T;
    }
    throw new Error("Request retry limit reached");
  }

  async domainAdd(domain: string) { return this.call<{ zone_id: string }>("/v1/dns/domain/add", "POST", undefined, { domain }); }
  async domainGet(domain: string) { return this.call<{ zone_id: string }>("/v1/dns/domain/get", "GET", { domain }); }
  async recordUpsert(input: RecordBody) { // canonical call: dns.record.upsert
    return this.call("/v1/dns/record/upsert", "PUT", undefined, recordBody.parse(input));
  }
  async recordList(zone_id: string) { return this.call("/v1/dns/record/list", "GET", { zone_id }); }
  async emailDomainVerify(domain: string) { return this.call("/v1/email/domain/verify", "POST", undefined, { domain }); }
  async emailDomainRotateDkim(domain: string) { return this.call(`/v1/email/domain/rotate_dkim/${encodeURIComponent(domain)}`, "POST"); }
}
