// 任务：发布 / 编辑 / 提交审核 / 取消（PRD 6.1、6.7）+ 任务市场浏览筛选（PRD 6.2）
//
// 状态跃迁一律走 constants/marketplace.js 的 canTransition()，路由里不写字面量。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  PROJECT_STATUS, PROJECT_CATEGORIES, DELIVERY_DAYS, CURRENCIES, canTransition,
  APPLICATION_STATUS, ESCROW_STATUS,
} = require('../constants/marketplace');
const { completeProjectWithRelease, autoConfirmDeadline } = require('../services/escrow');

const router = express.Router();

// Prisma Decimal 在 JSON 里会变成字符串；统一转成 number 再给前端。
function num(d) {
  return d == null ? null : Number(d);
}

const LIST_SELECT = {
  id: true, title: true, category: true, budgetMin: true, budgetMax: true,
  currency: true, deliveryDays: true, urgent: true, tags: true, stackPref: true,
  languageReq: true, status: true, applicationCount: true, publishedAt: true,
  createdAt: true, deliveredAt: true, completedAt: true,
  client: { select: { id: true, name: true } },
};

function serializeProject(p) {
  if (!p) return p;
  return { ...p, budgetMin: num(p.budgetMin), budgetMax: num(p.budgetMax) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 发布 / 编辑
// ─────────────────────────────────────────────────────────────────────────────
const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(1000),
  type: z.string().trim().max(40).optional(),   // image | figma | github | prd | reference
});

const projectBodySchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(20000),
  category: z.enum(PROJECT_CATEGORIES),
  budgetMin: z.number().positive().max(9999999).optional(),
  budgetMax: z.number().positive().max(9999999).optional(),
  currency: z.enum(CURRENCIES).default('CNY'),
  deliveryDays: z.number().int().refine((d) => DELIVERY_DAYS.includes(d), '交付周期不在可选档位'),
  urgent: z.boolean().default(false),
  languageReq: z.string().trim().max(40).optional(),
  stackPref: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  attachments: z.array(attachmentSchema).max(10).default([]),
}).refine((v) => v.budgetMin != null || v.budgetMax != null, {
  message: '预算至少填一个金额',
}).refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, {
  message: '预算下限不能高于上限',
});

const createSchema = z.object({ submit: z.boolean().default(false) }).passthrough();

// 只填一个金额 = 一口价：把区间补齐成 [amount, amount]。
// 这样市场筛选的 budgetMin/budgetMax 条件永远命中，不会漏掉半开区间的任务。
function normalizeBudget(data) {
  const amount = data.budgetMin ?? data.budgetMax;
  return { ...data, budgetMin: data.budgetMin ?? amount, budgetMax: data.budgetMax ?? amount };
}

// POST /api/projects — 新建任务。submit=true 直接进审核队列，否则存草稿。
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { submit } = createSchema.parse(req.body);
    const data = normalizeBudget(projectBodySchema.parse(req.body));
    const project = await prisma.project.create({
      data: {
        ...data,
        attachments: data.attachments.length ? data.attachments : undefined,
        clientId: req.userId,
        status: submit ? PROJECT_STATUS.PENDING_REVIEW : PROJECT_STATUS.DRAFT,
      },
      select: LIST_SELECT,
    });
    res.status(201).json(serializeProject(project));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/projects/mine — 客户自己的任务（必须排在 /:id 之前）
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' && PROJECT_STATUS[req.query.status]
      ? req.query.status : undefined;
    const items = await prisma.project.findMany({
      where: { clientId: req.userId, ...(status ? { status } : {}) },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: items.map(serializeProject) });
  } catch (e) { next(e); }
});

// PATCH /api/projects/:id — 仅草稿 / 审核驳回态可改
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, status: true },
    });
    if (!existing || existing.clientId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    if (existing.status !== PROJECT_STATUS.DRAFT && existing.status !== PROJECT_STATUS.REJECTED) {
      return res.status(409).json({ error: '任务已提交，无法编辑', code: 'NOT_EDITABLE' });
    }
    const data = normalizeBudget(projectBodySchema.parse(req.body));
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: { ...data, attachments: data.attachments.length ? data.attachments : null },
      select: LIST_SELECT,
    });
    res.json(serializeProject(project));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// POST /api/projects/:id/submit — 草稿 / 驳回 → 待审核
router.post('/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, status: true },
    });
    if (!p || p.clientId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    if (!canTransition(p.status, PROJECT_STATUS.PENDING_REVIEW)) {
      return res.status(409).json({ error: '当前状态不能提交审核', code: 'BAD_TRANSITION' });
    }
    const project = await prisma.project.update({
      where: { id: p.id },
      data: { status: PROJECT_STATUS.PENDING_REVIEW, reviewNote: null },
      select: LIST_SELECT,
    });
    res.json(serializeProject(project));
  } catch (e) { next(e); }
});

// POST /api/projects/:id/cancel — 取消。
// 已托管付款的（HELD/DISPUTED）必须走退款/仲裁；录用后客户一直未付款（PENDING）可直接取消。
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, status: true, escrow: { select: { id: true, status: true } } },
    });
    if (!p || p.clientId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    const fundedEscrow = p.escrow && p.escrow.status !== ESCROW_STATUS.PENDING;
    if ((p.status === PROJECT_STATUS.IN_PROGRESS || p.status === PROJECT_STATUS.REVIEW) && fundedEscrow) {
      return res.status(409).json({ error: '任务已进入托管交付，请走退款或纠纷流程', code: 'ESCROW_ACTIVE' });
    }
    if (p.status === PROJECT_STATUS.REVIEW) {
      return res.status(409).json({ error: '任务已进入托管交付，请走退款或纠纷流程', code: 'ESCROW_ACTIVE' });
    }
    if (!canTransition(p.status, PROJECT_STATUS.CANCELLED)) {
      return res.status(409).json({ error: '当前状态不能取消', code: 'BAD_TRANSITION' });
    }
    const project = await prisma.$transaction(async (tx) => {
      if (p.escrow && p.escrow.status === ESCROW_STATUS.PENDING) {
        await tx.escrowTransaction.update({
          where: { id: p.escrow.id },
          data: { status: ESCROW_STATUS.CANCELLED },
        });
      }
      return tx.project.update({
        where: { id: p.id },
        data: { status: PROJECT_STATUS.CANCELLED, cancelledAt: new Date() },
        select: LIST_SELECT,
      });
    });
    res.json(serializeProject(project));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 交付 / 验收（PRD 6.5）—— 托管放款在 escrow 模块挂接后接入 confirm。
// ─────────────────────────────────────────────────────────────────────────────
const deliverSchema = z.object({
  deliveryNote: z.string().trim().min(10).max(10000),
});

// POST /api/projects/:id/deliver — 受雇 Builder 提交交付：IN_PROGRESS → REVIEW。
// 托管未付款前不允许交付（保护 Builder）；交付即启动超时自动确认倒计时。
router.post('/:id/deliver', requireAuth, async (req, res, next) => {
  try {
    const { deliveryNote } = deliverSchema.parse(req.body);
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, hiredBuilderId: true, status: true, escrow: { select: { id: true, status: true } } },
    });
    if (!p || p.hiredBuilderId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    if (!canTransition(p.status, PROJECT_STATUS.REVIEW)) {
      return res.status(409).json({ error: '当前状态不能提交交付', code: 'BAD_TRANSITION' });
    }
    if (p.escrow && p.escrow.status === ESCROW_STATUS.PENDING) {
      return res.status(409).json({ error: '客户尚未托管付款，请先与客户确认', code: 'ESCROW_NOT_FUNDED' });
    }
    const now = new Date();
    const project = await prisma.$transaction(async (tx) => {
      if (p.escrow && p.escrow.status === ESCROW_STATUS.HELD) {
        await tx.escrowTransaction.update({
          where: { id: p.escrow.id },
          data: { autoConfirmAt: autoConfirmDeadline(now) },
        });
      }
      return tx.project.update({
        where: { id: p.id },
        data: { status: PROJECT_STATUS.REVIEW, deliveredAt: now, deliveryNote },
        select: LIST_SELECT,
      });
    });
    res.json(serializeProject(project));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// POST /api/projects/:id/confirm — 客户验收：REVIEW → COMPLETED + 托管放款（services/escrow.js）
router.post('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const project = await completeProjectWithRelease(req.params.id, { requireClientId: req.userId });
    res.json(serializeProject(project));
  } catch (e) { next(e); }
});

// POST /api/projects/:id/request-changes — 客户打回返工：REVIEW → IN_PROGRESS，暂停自动确认
router.post('/:id/request-changes', requireAuth, async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, status: true, escrow: { select: { id: true } } },
    });
    if (!p || p.clientId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    if (p.status !== PROJECT_STATUS.REVIEW || !canTransition(p.status, PROJECT_STATUS.IN_PROGRESS)) {
      return res.status(409).json({ error: '当前状态不能打回返工', code: 'BAD_TRANSITION' });
    }
    const project = await prisma.$transaction(async (tx) => {
      if (p.escrow) {
        await tx.escrowTransaction.update({
          where: { id: p.escrow.id },
          data: { autoConfirmAt: null },
        });
      }
      return tx.project.update({
        where: { id: p.id },
        data: { status: PROJECT_STATUS.IN_PROGRESS, deliveredAt: null },
        select: LIST_SELECT,
      });
    });
    res.json(serializeProject(project));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 任务市场（PRD 6.2）
// ─────────────────────────────────────────────────────────────────────────────
const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  budgetMin: z.coerce.number().nonnegative().optional(),   // 预算下限：只要任务上限 ≥ 它
  budgetMax: z.coerce.number().positive().optional(),      // 预算上限：只要任务下限 ≤ 它
  maxDeliveryDays: z.coerce.number().int().positive().optional(),
  urgent: z.enum(['true', 'false']).optional(),
  stack: z.string().trim().max(200).optional(),            // 逗号分隔，命中任一即可
  language: z.string().trim().max(40).optional(),
  // PRD 的「即将截止」在 V1 没有申请截止字段，改为「交付周期最短优先」
  sort: z.enum(['newest', 'budget', 'delivery']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

// GET /api/projects — 公开任务市场，仅列 OPEN。
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);

    const where = { status: PROJECT_STATUS.OPEN };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.category) where.category = q.category;
    if (q.currency) where.currency = q.currency;
    if (q.budgetMin != null) where.budgetMax = { gte: q.budgetMin };
    if (q.budgetMax != null) where.budgetMin = { lte: q.budgetMax };
    if (q.maxDeliveryDays != null) where.deliveryDays = { lte: q.maxDeliveryDays };
    if (q.urgent) where.urgent = q.urgent === 'true';
    if (q.language) where.languageReq = q.language;
    if (q.stack) {
      const stacks = q.stack.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
      if (stacks.length) where.stackPref = { hasSome: stacks };
    }

    const orderBy = {
      newest: [{ publishedAt: 'desc' }],
      budget: [{ budgetMax: 'desc' }, { publishedAt: 'desc' }],
      delivery: [{ deliveryDays: 'asc' }, { publishedAt: 'desc' }],
    }[q.sort];

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: LIST_SELECT,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    // 登录用户：标出自己已申请过的任务，前端好置灰按钮。
    let appliedIds = new Set();
    if (req.userId && items.length) {
      const mine = await prisma.application.findMany({
        where: { builderId: req.userId, projectId: { in: items.map((i) => i.id) } },
        select: { projectId: true },
      });
      appliedIds = new Set(mine.map((a) => a.projectId));
    }

    res.json({
      items: items.map((p) => ({ ...serializeProject(p), hasApplied: appliedIds.has(p.id) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '筛选参数不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/projects/:id — 详情。已发布过的任务对所有人可见；未发布的只有本人能看。
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: {
        ...LIST_SELECT,
        description: true, attachments: true, dueAt: true, deliveryNote: true,
        hiredBuilderId: true, reviewNote: true, clientId: true,
      },
    });
    if (!p) return res.status(404).json({ error: '任务不存在' });

    const isOwner = req.userId && req.userId === p.clientId;
    const isHired = req.userId && req.userId === p.hiredBuilderId;
    if (!p.publishedAt && !isOwner) return res.status(404).json({ error: '任务不存在' });

    let hasApplied = false;
    if (req.userId && !isOwner) {
      const mine = await prisma.application.findUnique({
        where: { projectId_builderId: { projectId: p.id, builderId: req.userId } },
        select: { status: true },
      });
      hasApplied = !!mine && mine.status !== APPLICATION_STATUS.WITHDRAWN;
    }

    const out = serializeProject(p);
    // 审核备注只给发布者看；交付说明只给双方看。
    if (!isOwner) delete out.reviewNote;
    if (!isOwner && !isHired) delete out.deliveryNote;
    res.json({ ...out, isOwner: !!isOwner, isHiredBuilder: !!isHired, hasApplied });
  } catch (e) { next(e); }
});

module.exports = router;
