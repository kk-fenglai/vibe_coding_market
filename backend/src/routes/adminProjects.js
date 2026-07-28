// 后台：任务审核队列（PRD 6.1 —— V1 人工审核，防垃圾与违规需求）
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAdmin, writeAdminLog, clientIp } = require('../middleware/admin');
const { PROJECT_STATUS, canTransition } = require('../constants/marketplace');
const { notifyProjectReviewed } = require('../services/notify');

const router = express.Router();
router.use(requireAdmin);

const ADMIN_SELECT = {
  id: true, title: true, category: true, budgetMin: true, budgetMax: true,
  currency: true, deliveryDays: true, urgent: true, tags: true, stackPref: true,
  status: true, reviewNote: true, reviewedAt: true, publishedAt: true,
  applicationCount: true, createdAt: true,
  client: { select: { id: true, email: true, name: true, createdAt: true } },
};

function serialize(p) {
  return { ...p, budgetMin: p.budgetMin == null ? null : Number(p.budgetMin), budgetMax: p.budgetMax == null ? null : Number(p.budgetMax) };
}

const listSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// GET /api/admin/projects — 默认列出待审核队列
router.get('/', async (req, res, next) => {
  try {
    const q = listSchema.parse(req.query);
    const status = q.status && PROJECT_STATUS[q.status] ? q.status : PROJECT_STATUS.PENDING_REVIEW;
    const where = { status };
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: { createdAt: 'asc' },   // 先到先审
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.project.count({ where }),
    ]);
    res.json({ items: items.map(serialize), total, page: q.page, pageSize: q.pageSize });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '参数不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/admin/projects/:id — 审核详情（含正文与附件）
router.get('/:id', async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { ...ADMIN_SELECT, description: true, attachments: true, languageReq: true },
    });
    if (!p) return res.status(404).json({ error: '任务不存在' });
    res.json(serialize(p));
  } catch (e) { next(e); }
});

const rejectSchema = z.object({ note: z.string().trim().min(1).max(500) });

// 审核动作共用：查任务 → 校验跃迁 → 落库 → 审计日志 → 通知客户
async function review(req, res, next, { approve }) {
  try {
    const target = approve ? PROJECT_STATUS.OPEN : PROJECT_STATUS.REJECTED;
    const note = approve ? null : rejectSchema.parse(req.body).note;

    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, status: true, client: { select: { id: true, email: true, name: true } } },
    });
    if (!p) return res.status(404).json({ error: '任务不存在' });
    if (!canTransition(p.status, target)) {
      return res.status(409).json({ error: `${p.status} 不能变更为 ${target}`, code: 'BAD_TRANSITION' });
    }

    const updated = await prisma.project.update({
      where: { id: p.id },
      data: {
        status: target,
        reviewNote: note,
        reviewedAt: new Date(),
        reviewedById: req.admin.id,
        ...(approve ? { publishedAt: new Date() } : {}),
      },
      select: ADMIN_SELECT,
    });

    await writeAdminLog({
      adminId: req.admin.id,
      action: approve ? 'PROJECT_APPROVE' : 'PROJECT_REJECT',
      targetType: 'PROJECT',
      targetId: p.id,
      payload: { from: p.status, to: target, note },
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] || '').slice(0, 500),
    });

    // 通知不阻塞响应，也不回滚审核结果。
    notifyProjectReviewed({
      email: p.client.email,
      name: p.client.name,
      project: { id: p.id, title: p.title },
      approved: approve,
      note,
    });

    res.json(serialize(updated));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '请填写驳回原因', code: 'INVALID' });
    next(e);
  }
}

// POST /api/admin/projects/:id/approve — 通过 → 上架任务市场
router.post('/:id/approve', (req, res, next) => review(req, res, next, { approve: true }));

// POST /api/admin/projects/:id/reject — 驳回（必须写原因，会发给客户）
router.post('/:id/reject', (req, res, next) => review(req, res, next, { approve: false }));

module.exports = router;
