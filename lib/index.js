/**
 * dsh-eyes-upload — host half.
 *
 * Serves POST /api/eyes-upload: accepts a base64 image, validates it (magic
 * bytes, 20MB cap), saves it under the configured upload dir, runs the
 * deepseek-eyes vision client (Qwen-VL via ModelScope) against it, and keeps
 * the analysis PENDING for the uploading session. Nothing is shown to the
 * user beyond a small "上传成功" acknowledgement — the next genuine user
 * message of that session enters its model step with the analysis attached
 * (agent/pre-step injection), so the upload is an invisible deepseek-eyes
 * call carried along the user's next message.
 *
 * Plain Node ESM; only node builtins.
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-eyes-upload'
export const inject = ['webServer', 'skills']

const MAX_BYTES = 20 * 1024 * 1024
const BODY_CAP = MAX_BYTES + 64 * 1024

const MAGIC = [
  { ext: 'png', head: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', head: [0xff, 0xd8, 0xff] },
  { ext: 'gif', head: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'webp', head: [0x52, 0x49, 0x46, 0x46] },
  { ext: 'bmp', head: [0x42, 0x4d] },
]

function detectExt(buf) {
  for (const { ext, head } of MAGIC) {
    if (buf.length >= head.length && head.every((b, i) => buf[i] === b)) return ext
  }
  return null
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 会话 → 待附带的隐性分析列表(用户下一条真实消息的模型步骤注入后清空)。 */
const pending = new Map()

function createUserMessage(content, source) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: content }],
    source,
  }
}

/** 极简 frontmatter 解析:提取 name/description 与正文。 */
function parseSkillMd(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body: match[2] }
}

/** 把随包携带的 deepseek-eyes 技能注册进全局技能目录(任何 preset 的会话都可见)。 */
function registerSkill(ctx) {
  try {
    const skillPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md')
    const { meta, body } = parseSkillMd(readFileSync(skillPath, 'utf8'))
    const skillName = meta.name ?? 'deepseek-eyes'
    if (!/^[a-z0-9][a-z0-9-]*$/.test(skillName)) throw new Error(`invalid skill name: ${skillName}`)
    ctx.skills.register({
      name: skillName,
      description: meta.description ?? '',
      content: body,
      path: skillPath,
      source: 'bundled',
    })
    ctx.logger?.info?.('dsh-eyes-upload: registered skill', skillName)
  } catch (error) {
    ctx.logger?.error?.('dsh-eyes-upload: skill registration failed:', String(error?.message ?? error))
  }
}

export function apply(ctx, config) {
  // 配置优先级: cordis 行 config > 环境变量 > 代码默认值。
  // 环境变量名: EYES_API_KEY / EYES_PYTHON / EYES_REPO_DIR / EYES_UPLOAD_DIR
  const uploadDir = config.uploadDir ?? process.env.EYES_UPLOAD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads')
  const python = config.python ?? process.env.EYES_PYTHON ?? 'python3'
  const repoDir = config.repoDir ?? process.env.EYES_REPO_DIR ?? process.cwd()
  const apiKey = config.apiKey ?? process.env.EYES_API_KEY ?? ''
  mkdirSync(uploadDir, { recursive: true })
  const analyzeScript = join(dirname(fileURLToPath(import.meta.url)), 'analyze.py')
  const reportLog = join(uploadDir, 'client-errors.log')

  // 技能随插件全局注册:装了这个插件,任何会话都自动带上 deepseek-eyes 技能
  registerSkill(ctx)

  // 浏览器端诊断通道:客户端渲染/逻辑错误上报到这里,便于主机侧排查。
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/eyes-report',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'POST only' })
          return
        }
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 64 * 1024) throw new Error('请求体过大')
          chunks.push(chunk)
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        appendFileSync(reportLog, `${new Date().toISOString()} ${JSON.stringify(payload)}\n`)
        json(res, 200, { ok: true })
      } catch (error) {
        json(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    },
  })

  // 删除一张已挂起的上传(用户点 ✕):从挂起列表移除并删掉磁盘文件。
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/eyes-remove',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'POST only' })
          return
        }
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 64 * 1024) throw new Error('请求体过大')
          chunks.push(chunk)
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.length > 0 ? payload.sessionId : null
        const id = typeof payload.id === 'string' && payload.id.length > 0 ? payload.id : null
        if (sessionId === null || id === null) throw new Error('缺少 sessionId 或 id')
        const list = pending.get(sessionId)
        let removed = false
        if (list !== undefined) {
          const idx = list.findIndex((entry) => entry.id === id)
          if (idx >= 0) {
            const [entry] = list.splice(idx, 1)
            try {
              const { unlinkSync } = await import('node:fs')
              unlinkSync(entry.path)
            } catch { /* 文件删除失败不阻塞 */ }
            removed = true
          }
          if (list.length === 0) pending.delete(sessionId)
        }
        json(res, 200, { ok: true, removed })
      } catch (error) {
        json(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/eyes-upload',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'POST only' })
          return
        }
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > BODY_CAP) throw new Error('请求体过大')
          chunks.push(chunk)
        }
        let payload
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          throw new Error('JSON 解析失败')
        }
        if (typeof payload.data !== 'string' || payload.data.length === 0) {
          throw new Error('缺少图片数据')
        }
        const buf = Buffer.from(payload.data, 'base64')
        if (buf.length > MAX_BYTES) throw new Error('图片超过 20MB 限制')
        const ext = detectExt(buf)
        if (ext === null) throw new Error('不是支持的图片格式(png/jpg/gif/webp/bmp)')

        const rawName = typeof payload.name === 'string' && payload.name.length > 0 ? payload.name : 'image'
        const cleaned = rawName.replace(/\.(png|jpe?g|gif|webp|bmp)$/i, '')
        const safeName = basename(cleaned).replace(/[^\w.\u4e00-\u9fa5-]/g, '_').slice(0, 80)
        const file = join(uploadDir, `${Date.now()}-${safeName}.${ext}`)
        writeFileSync(file, buf)

        const result = spawnSync(python, [analyzeScript, file], {
          cwd: repoDir,
          env: { ...process.env, MODELSCOPE_API_KEY: apiKey },
          timeout: 180000,
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        })
        let description
        if (result.status === 0) {
          description = (result.stdout ?? '').trim()
        } else {
          const detail = (result.stderr ?? (result.error ? result.error.message : 'unknown')).slice(0, 400)
          description = `[自动分析失败] ${detail}`
        }
        if (description.length === 0) description = '[自动分析失败] 空结果'

        // 隐性挂起:该会话的下一条真实用户消息会在模型步骤里附带这份分析
        const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.length > 0 ? payload.sessionId : null
        const id = basename(file)
        if (sessionId !== null) {
          const list = pending.get(sessionId) ?? []
          list.push({ id, name: safeName, path: file, description })
          pending.set(sessionId, list)
        }

        json(res, 200, { ok: true, id, name: safeName, bytes: buf.length })
      } catch (error) {
        json(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    },
  })

  // 每个 agent 的模型步骤前:若该会话有挂起的上传分析且本步骤由真实用户消息
  // 驱动,则把分析作为一条额外消息注入,并清空挂起列表。
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.effect(() => {
      const stop = agent.ctx.on('agent/pre-step', async ({ messages }, next) => {
        const decision = await next()
        if (decision.kind === 'reject') return decision
        const list = pending.get(agent.session.id)
        if (list === undefined || list.length === 0) return decision
        const drivenByUserMessage = messages.some((m) => m.source !== undefined && m.source.kind === 'user')
        if (!drivenByUserMessage) return decision
        pending.delete(agent.session.id)
        const parts = []
        parts.push(`[本条消息附带 ${list.length} 张用户上传图片的 deepseek-eyes 隐性分析(用户上传后未在输入框/弹窗展示过内容)]`)
        for (let i = 0; i < list.length; i++) {
          const entry = list[i]
          parts.push(`图片 ${i + 1}: ${entry.name}`)
          parts.push(entry.description)
          parts.push(`(已保存到 ${entry.path};如需更精确的 OCR/代码提取/图表解读,请用 deepseek-eyes 直接分析该文件)`)
        }
        const injection = createUserMessage(parts.join('\n'), { kind: 'eyes-upload', count: list.length })
        return { kind: 'enter', messages: [...decision.messages, injection] }
      })
      return () => {
        stop()
      }
    }, 'dsh-eyes-upload: pre-step pending-analysis injection')
  })
}
