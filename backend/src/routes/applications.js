// 申请接单（PRD 6.3）+ 雇佣（PRD 6.4）
//
// 挂载在 /api 根：同时覆盖 /projects/:id/applications 与 /applications/*。
// V1 说明：接受申请即进入 IN_PROGRESS（雇佣成立）；托管支付模块挂接后，
// 此跃迁改为「客户付款入托管」时触发（见 constants/marketplace.js ESCROW_STATUS）。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const {
  PROJECT_STATUS, APPLICATION_STATUS, MAX_APPLICATIONS_PER_PROJECT, canTransition,
} = require('../constants/marketplace');
const { resolveFeeRate, createEscrowForHire } = require('../services/escrow');

const router = express.Router();

function num(d) {
  return d == null ? null : Number(d);
}

const APP_SELECT = {
  id: true, projectId: true, builderId: true, bidAmount: true, currency: true,
  estimatedDays: true, pitch: true, portfolioUrl: true, status: true,
  respondedAt: true, createdAt: true,
};

// 业主视角需要看申请人资料；Builder 视角需要看任务概要。
const APP_WITH_BUILDER = {
  ...APP_SELECT,
  builder: {
    select: {
      id: true, name: true,
      builderProfile: {
        select: {
          headline: true, skills: true, aiTools: true, verified: true,
          completedCount: true, ratingSum: true, ratingCount: true,
        },
      },
    },
  },
};

const APP_WITH_PROJECT = {
  ...APP_SELECT,
  project: {
    select: {
      id: true, title: true, category: true, status: true, currency: true,
      budgetMin: true, budgetMax: true, deliveryDays: true, clientId: true,
    },
  },
};

function serializeApp(a) {
  if (!a) return a;
  const out = { ...a, bidAmount: num(a.bidAmount) };
  if (out.project) {
    out.project = {
      ...out.project,
      budgetMin: num(out.project.budgetMin),
      budgetMax: num(out.project.budgetMax),
    };
  }
  return out;
}

const applyBodySchema = z.object({
  bidAmount: z.number().positive().max(9999999),
  estimatedDays: z.number().int().positive().max(60),
  pitch: z.string().trim().min(10).max(2000),
  portfolioUrl: z.string().trim().url().max(1000).optional(),
});

// POST /api/projects/:id/applications — Builder 投标。需先建 BuilderProfile。
router.post('/projects/:id/applications', requireAuth, async (req, res, next) => {
  try {
    const body = applyBodySchema.parse(req.body);

    const profile = await prisma.builderProfile.findUnique({
      where: { userId: req.userId },
      select: { id: true },
    });
    if (!profile) {
      return res.status(403).json({ error: '请先完善 Builder 资料再申请任务', code: 'NO_BUILDER_PROFILE' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, status: true, currency: true, applicationCount: true },
    });
    if (!project || project.status !== PROJECT_STATUS.OPEN) {
      return res.status(404).json({ error: '任务不存在或未开放申请' });
    }
    if (project.clientId === req.userId) {
      return res.status(409).json({ error: '不能申请自己发布的任务', code: 'OWN_PROJECT' });
    }
    if (project.applicationCount >= MAX_APPLICATIONS_PER_PROJECT) {
      return res.status(409).json({ error: '该任务申请人数已满', code: 'APPLICATIONS_FULL' });
    }

    // 撤回过的申请占着 @@unique([projectId, builderId]) 槽位：重投 = 把旧行改回 PENDING。
    const existing = await prisma.application.findUnique({
      where: { projectId_builderId: { projectId: project.id, builderId: req.userId } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== APPLICATION_STATUS.WITHDRAWN) {
      return res.status(409).json({ error: '你已申请过该任务', code: 'ALREADY_APPLIED' });
    }

    const bidData = {
      bidAmount: body.bidAmount,
      currency: project.currency,   // 报价一律用任务币种
      estimatedDays: body.estimatedDays,
      pitch: body.pitch,
      portfolioUrl: body.portfolioUrl ?? null,
    };
    const [application] = await prisma.$transaction([
      existing
        ? prisma.application.update({
          where: { id: existing.id },
          data: { ...bidData, status: APPLICATION_STATUS.PENDING, respondedAt: null },
          select: APP_SELECT,
        })
        : prisma.application.create({
          data: { projectId: project.id, builderId: req.userId, ...bidData },
          select: APP_SELECT,
        }),
      prisma.project.update({
        where: { id: project.id },
        data: { applicationCount: { increment: 1 } },
      }),
    ]);
    res.status(201).json(serializeApp(application));
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '你已申请过该任务', code: 'ALREADY_APPLIED' });
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/projects/:id/applications — 仅业主查看申请列表
router.get('/projects/:id/applications', requireAuth, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true },
    });
    if (!project || project.clientId !== req.userId) return res.status(404).json({ error: '任务不存在' });
    const items = await prisma.application.findMany({
      where: { projectId: project.id },
      select: APP_WITH_BUILDER,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items: items.map(serializeApp) });
  } catch (e) { next(e); }
});

// GET /api/applications/mine — Builder 自己的投标记录
router.get('/applications/mine', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.application.findMany({
      where: { builderId: req.userId },
      select: APP_WITH_PROJECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: items.map(serializeApp) });
  } catch (e) { next(e); }
});

// POST /api/applications/:id/accept — 业主录用：项目 OPEN → IN_PROGRESS，
// 其余 PENDING 申请同时批量拒绝（Upwork 式一单一雇），并按成交报价创建托管单（等付款）。
router.post('/applications/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, projectId: true, builderId: true, status: true,
        bidAmount: true, currency: true,
        project: { select: { id: true, clientId: true, status: true, deliveryDays: true } },
      },
    });
    if (!app || app.project.clientId !== req.userId) return res.status(404).json({ error: '申请不存在' });
    if (app.status !== APPLICATION_STATUS.PENDING) {
      return res.status(409).json({ error: '该申请已被处理', code: 'ALREADY_RESPONDED' });
    }
    if (!canTransition(app.project.status, PROJECT_STATUS.IN_PROGRESS)) {
      return res.status(409).json({ error: '当前任务状态不能录用', code: 'BAD_TRANSITION' });
    }

    const feeRate = await resolveFeeRate(req.userId, app.builderId);
    const now = new Date();
    const dueAt = new Date(now.getTime() + app.project.deliveryDays * 24 * 60 * 60 * 1000);
    const accepted = await prisma.$transaction(async (tx) => {
      const acc = await tx.application.update({
        where: { id: app.id },
        data: { status: APPLICATION_STATUS.ACCEPTED, respondedAt: now },
        select: APP_SELECT,
      });
      await tx.application.updateMany({
        where: { projectId: app.projectId, status: APPLICATION_STATUS.PENDING, id: { not: app.id } },
        data: { status: APPLICATION_STATUS.REJECTED, respondedAt: now },
      });
      await tx.project.update({
        where: { id: app.projectId },
        data: {
          status: PROJECT_STATUS.IN_PROGRESS,
          hiredBuilderId: app.builderId,
          hiredApplicationId: app.id,
          hiredAt: now,
          dueAt,
        },
      });
      await createEscrowForHire(tx, {
        projectId: app.projectId,
        clientId: req.userId,
        builderId: app.builderId,
        amount: Number(app.bidAmount),
        currency: app.currency,
        feeRate,
      });
      return acc;
    });
    res.json(serializeApp(accepted));
  } catch (e) { next(e); }
});

// POST /api/applications/:id/reject — 业主拒绝单条申请
router.post('/applications/:id/reject', requireAuth, async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, project: { select: { clientId: true } } },
    });
    if (!app || app.project.clientId !== req.userId) return res.status(404).json({ error: '申请不存在' });
    if (app.status !== APPLICATION_STATUS.PENDING) {
      return res.status(409).json({ error: '该申请已被处理', code: 'ALREADY_RESPONDED' });
    }
    const rejected = await prisma.application.update({
      where: { id: app.id },
      data: { status: APPLICATION_STATUS.REJECTED, respondedAt: new Date() },
      select: APP_SELECT,
    });
    res.json(serializeApp(rejected));
  } catch (e) { next(e); }
});

// POST /api/applications/:id/withdraw — Builder 撤回，释放申请名额
router.post('/applications/:id/withdraw', requireAuth, async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id },
      select: { id: true, projectId: true, builderId: true, status: true },
    });
    if (!app || app.builderId !== req.userId) return res.status(404).json({ error: '申请不存在' });
    if (app.status !== APPLICATION_STATUS.PENDING) {
      return res.status(409).json({ error: '该申请已被处理，无法撤回', code: 'ALREADY_RESPONDED' });
    }
    const [withdrawn] = await prisma.$transaction([
      prisma.application.update({
        where: { id: app.id },
        data: { status: APPLICATION_STATUS.WITHDRAWN, respondedAt: new Date() },
        select: APP_SELECT,
      }),
      prisma.project.update({
        where: { id: app.projectId },
        data: { applicationCount: { decrement: 1 } },
      }),
    ]);
    res.json(serializeApp(withdrawn));
  } catch (e) { next(e); }
});

module.exports = router;
