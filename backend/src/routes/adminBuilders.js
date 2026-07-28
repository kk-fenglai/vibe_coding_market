// 后台：Verified Builder 认证审核（PRD 7.3 —— V1 人工审核）
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAdmin, writeAdminLog, clientIp } = require('../middleware/admin');

const router = express.Router();
router.use(requireAdmin);

const ADMIN_SELECT = {
  id: true, userId: true, headline: true, bio: true, country: true,
  languages: true, skills: true, aiTools: true, githubUrl: true, websiteUrl: true,
  verified: true, verifiedAt: true, verifyNote: true,
  completedCount: true, ratingSum: true, ratingCount: true, createdAt: true,
  user: { select: { id: true, email: true, name: true, createdAt: true } },
  portfolio: { select: { id: true, title: true, demoUrl: true, repoUrl: true } },
};

const listSchema = z.object({
  verified: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// GET /api/admin/builders — Builder 列表（默认待认证在前）
router.get('/', async (req, res, next) => {
  try {
    const q = listSchema.parse(req.query);
    const where = {};
    if (q.verified) where.verified = q.verified === 'true';
    if (q.q) {
      where.OR = [
        { headline: { contains: q.q, mode: 'insensitive' } },
        { user: { email: { contains: q.q, mode: 'insensitive' } } },
        { user: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.builderProfile.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: [{ verified: 'asc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.builderProfile.count({ where }),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '参数不合法', code: 'INVALID' });
    next(e);
  }
});

const verifySchema = z.object({
  verified: z.boolean(),
  note: z.string().trim().max(1000).optional(),   // 审核备注 / 驳回原因
});

// POST /api/admin/builders/:userId/verify — 通过 / 撤销认证
router.post('/:userId/verify', async (req, res, next) => {
  try {
    const { verified, note } = verifySchema.parse(req.body);
    const profile = await prisma.builderProfile.findUnique({
      where: { userId: req.params.userId },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Builder 不存在' });

    const updated = await prisma.builderProfile.update({
      where: { id: profile.id },
      data: {
        verified,
        verifiedAt: verified ? new Date() : null,
        verifyNote: note ?? null,
        verifiedById: req.admin.id,
      },
      select: ADMIN_SELECT,
    });
    await writeAdminLog({
      adminId: req.admin.id,
      action: verified ? 'builder.verify' : 'builder.unverify',
      targetType: 'BuilderProfile',
      targetId: profile.id,
      payload: { userId: req.params.userId, note: note ?? null },
      ip: clientIp(req),
    });
    res.json(updated);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

module.exports = router;
