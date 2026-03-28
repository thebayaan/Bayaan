/**
 * R2 Migrator Worker
 *
 * Two modes:
 *   1. HTTP API — enqueue migration tasks and check status
 *   2. Queue consumer — processes migration tasks from the queue
 *
 * Flow:
 *   POST /enqueue → pushes file tasks to Queue → Queue triggers consumer
 *   → consumer fetches from source and writes to R2
 *
 * Endpoints:
 *   POST /enqueue     — enqueue a batch of files for migration
 *   POST /migrate     — direct migration (no queue, for small batches)
 *   POST /migrate-one — migrate a single file directly
 *   POST /verify      — verify files exist in R2
 *   GET  /check       — check if a key exists in R2
 *   GET  /status      — migration progress stats
 *   GET  /health      — health check
 */

interface Env {
	AUDIO_BUCKET: R2Bucket;
	MIGRATION_QUEUE: Queue<MigrateMessage>;
	MIGRATION_STATUS: KVNamespace;
	AUTH_TOKEN: string;
}

interface MigrateRequest {
	source_url: string;
	r2_key: string;
}

interface MigrateMessage {
	source_url: string;
	r2_key: string;
	batch_id?: string;
}

interface MigrateResult {
	r2_key: string;
	success: boolean;
	size?: number;
	error?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Auth check
		const authHeader = request.headers.get("Authorization");
		if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const url = new URL(request.url);

		if (url.pathname === "/health" && request.method === "GET") {
			return Response.json({ status: "ok", bucket: "bayaan-audio" });
		}

		if (url.pathname === "/status" && request.method === "GET") {
			const counters = JSON.parse((await env.MIGRATION_STATUS.get("counters")) || '{"s":0,"f":0}');
			const enqueued = parseInt((await env.MIGRATION_STATUS.get("enqueued")) || "0");
			const succeeded = counters.s;
			const failed = counters.f;
			const processed = succeeded + failed;

			return Response.json({
				enqueued,
				processed,
				succeeded,
				failed,
				remaining: Math.max(0, enqueued - processed),
				percent_done: enqueued > 0 ? Math.round((processed / enqueued) * 100) : 0,
			});
		}

		if (url.pathname === "/status/reset" && request.method === "POST") {
			await env.MIGRATION_STATUS.put("counters", '{"s":0,"f":0}');
			await env.MIGRATION_STATUS.put("enqueued", "0");
			return Response.json({ status: "reset" });
		}

		if (url.pathname === "/check" && request.method === "GET") {
			const key = url.searchParams.get("key");
			if (!key) return Response.json({ error: "Missing ?key=" }, { status: 400 });

			const obj = await env.AUDIO_BUCKET.head(key);
			return Response.json({ exists: obj !== null, key });
		}

		if (url.pathname === "/verify" && request.method === "POST") {
			const body = (await request.json()) as { keys: string[] };
			if (!body.keys || body.keys.length === 0) {
				return Response.json({ error: "No keys provided" }, { status: 400 });
			}
			if (body.keys.length > 200) {
				return Response.json({ error: "Max 200 keys per request" }, { status: 400 });
			}

			const results = await Promise.all(
				body.keys.map(async (key) => {
					const obj = await env.AUDIO_BUCKET.head(key);
					return {
						key,
						exists: obj !== null,
						size: obj?.size ?? null,
					};
				})
			);

			const existing = results.filter((r) => r.exists).length;
			const missing = results.filter((r) => !r.exists);

			return Response.json({ total: results.length, existing, missing_count: missing.length, missing });
		}

		if (url.pathname === "/enqueue" && request.method === "POST") {
			const body = (await request.json()) as { files: MigrateRequest[]; batch_id?: string };

			if (!body.files || body.files.length === 0) {
				return Response.json({ error: "No files provided" }, { status: 400 });
			}

			// Enqueue in chunks of 100 (Queue max batch size)
			const messages: MessageSendRequest<MigrateMessage>[] = body.files.map((file) => ({
				body: {
					source_url: file.source_url,
					r2_key: file.r2_key,
					batch_id: body.batch_id,
				},
			}));

			for (let i = 0; i < messages.length; i += 100) {
				const chunk = messages.slice(i, i + 100);
				await env.MIGRATION_QUEUE.sendBatch(chunk);
			}

			// Track enqueued count
			const current = parseInt((await env.MIGRATION_STATUS.get("enqueued")) || "0");
			await env.MIGRATION_STATUS.put("enqueued", String(current + body.files.length));

			return Response.json({
				enqueued: body.files.length,
				total_enqueued: current + body.files.length,
			});
		}

		if (url.pathname === "/migrate-one" && request.method === "POST") {
			const body = (await request.json()) as MigrateRequest;
			const result = await migrateOne(env.AUDIO_BUCKET, body);
			return Response.json(result);
		}

		if (url.pathname === "/migrate" && request.method === "POST") {
			const body = (await request.json()) as { files: MigrateRequest[] };

			if (!body.files || body.files.length === 0) {
				return Response.json({ error: "No files provided" }, { status: 400 });
			}
			if (body.files.length > 50) {
				return Response.json(
					{ error: "Max 50 files per batch" },
					{ status: 400 }
				);
			}

			const results = await Promise.all(
				body.files.map((file) => migrateOne(env.AUDIO_BUCKET, file))
			);

			const succeeded = results.filter((r) => r.success).length;
			const failed = results.filter((r) => !r.success).length;

			return Response.json({ succeeded, failed, total: results.length, results });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	},

	// Queue consumer — processes migration tasks
	async queue(batch: MessageBatch<MigrateMessage>, env: Env): Promise<void> {
		let succeeded = 0;
		let failed = 0;

		// Process all messages with controlled concurrency (4 at a time)
		const concurrency = 4;
		const messages = [...batch.messages];

		for (let i = 0; i < messages.length; i += concurrency) {
			const chunk = messages.slice(i, i + concurrency);
			await Promise.allSettled(
				chunk.map(async (msg) => {
					try {
						const result = await migrateOne(env.AUDIO_BUCKET, {
							source_url: msg.body.source_url,
							r2_key: msg.body.r2_key,
						});
						if (result.success) {
							succeeded++;
						} else {
							failed++;
						}
					} catch {
						failed++;
					}
				})
			);
		}

		// Ack all messages regardless — no retries, we'll re-enqueue to catch gaps
		batch.ackAll();

		// Best-effort KV update for progress tracking
		try {
			const prev = JSON.parse((await env.MIGRATION_STATUS.get("counters")) || '{"s":0,"f":0}');
			await env.MIGRATION_STATUS.put("counters", JSON.stringify({
				s: prev.s + succeeded,
				f: prev.f + failed,
			}));
		} catch {
			// Ignore — /verify endpoint is the real source of truth
		}
	},
};

async function migrateOne(
	bucket: R2Bucket,
	req: MigrateRequest
): Promise<MigrateResult> {
	try {
		// Check if already exists
		const existing = await bucket.head(req.r2_key);
		if (existing) {
			return { r2_key: req.r2_key, success: true, size: existing.size };
		}

		// Fetch from source
		const response = await fetch(req.source_url, {
			headers: { "User-Agent": "Bayaan-R2-Migrator/1.0" },
		});

		if (!response.ok) {
			return {
				r2_key: req.r2_key,
				success: false,
				error: `Fetch failed: ${response.status} ${response.statusText}`,
			};
		}

		const contentLength = response.headers.get("content-length");
		const body = response.body;
		if (!body) {
			return { r2_key: req.r2_key, success: false, error: "Empty response body" };
		}

		// Stream directly to R2
		await bucket.put(req.r2_key, body, {
			httpMetadata: {
				contentType: "audio/mpeg",
				cacheControl: "public, max-age=31536000, immutable",
			},
		});

		return {
			r2_key: req.r2_key,
			success: true,
			size: contentLength ? parseInt(contentLength) : undefined,
		};
	} catch (err: any) {
		return {
			r2_key: req.r2_key,
			success: false,
			error: err.message || String(err),
		};
	}
}
