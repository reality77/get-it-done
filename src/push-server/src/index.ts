import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import { ensureSubsDb, ensureFiredRemindersDb, validateSession, saveSubscription, deleteSubscription } from './couch.js'
import type { PushSubscription } from './couch.js'
import { startScheduler } from './scheduler.js'

// ── Fastify instance ──────────────────────────────────────────────────────────

const app = Fastify({ logger: true })

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.log.info({ allowedOrigins }, 'Configured CORS origins')

app.addHook('onRequest', async (request) => {
  app.log.info(
    {
      method: request.method,
      url: request.url,
      origin: request.headers.origin,
      host: request.headers.host,
      accessControlRequestMethod: request.headers['access-control-request-method'],
      accessControlRequestHeaders: request.headers['access-control-request-headers'],
    },
    'Incoming request',
  )
})

app.register(cors, {
  credentials: true,
  methods: ['POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      app.log.info({ origin, allowed: true }, 'CORS origin accepted')
      callback(null, true)
      return
    }
    app.log.warn({ origin, allowedOrigins }, 'CORS origin rejected')
    callback(new Error(`Origin not allowed: ${origin}`), false)
  },
})

// ── Type augmentation for per-request userId ──────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

// ── Auth pre-handler: validate CouchDB session cookie ─────────────────────────

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const cookie = request.headers.cookie ?? ''
  const userId = await validateSession(cookie)
  if (!userId) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }
  request.userId = userId
}

// ── Routes ────────────────────────────────────────────────────────────────────

interface SubscribeBody {
  subscription: PushSubscription
  dailyReminderTime?: string | null
}

interface UnsubscribeBody {
  endpoint: string
}

async function handleSubscribe(request: FastifyRequest<{ Body: SubscribeBody }>, reply: FastifyReply): Promise<FastifyReply> {
  const { subscription, dailyReminderTime } = request.body
  await saveSubscription(request.userId, subscription, dailyReminderTime ?? null)
  return reply.status(201).send({ ok: true })
}

async function handleUnsubscribe(request: FastifyRequest<{ Body: UnsubscribeBody }>, reply: FastifyReply): Promise<FastifyReply> {
  await deleteSubscription(request.userId, request.body.endpoint)
  return reply.status(204).send()
}

app.post<{ Body: SubscribeBody }>(
  '/api/push/subscribe',
  { preHandler: requireAuth },
  handleSubscribe,
)

app.delete<{ Body: UnsubscribeBody }>(
  '/api/push/subscribe',
  { preHandler: requireAuth },
  handleUnsubscribe,
)

app.options('/api/push/subscribe', async (_request, reply) => reply.status(204).send())

// Compatibility routes for reverse proxies that strip the /api/push prefix.
app.post<{ Body: SubscribeBody }>('/subscribe', { preHandler: requireAuth }, handleSubscribe)
app.delete<{ Body: UnsubscribeBody }>('/subscribe', { preHandler: requireAuth }, handleUnsubscribe)
app.options('/subscribe', async (_request, reply) => reply.status(204).send())

app.setNotFoundHandler((request, reply) => {
  app.log.warn(
    {
      method: request.method,
      url: request.url,
      origin: request.headers.origin,
      host: request.headers.host,
      accessControlRequestMethod: request.headers['access-control-request-method'],
      accessControlRequestHeaders: request.headers['access-control-request-headers'],
    },
    'Route not found',
  )
  reply.status(404).send({ error: 'Not Found' })
})

// ── Startup ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000)

async function start(): Promise<void> {
  await ensureSubsDb()
  await ensureFiredRemindersDb()
  startScheduler()
  await app.listen({ port: PORT, host: '0.0.0.0' })
}

start().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
