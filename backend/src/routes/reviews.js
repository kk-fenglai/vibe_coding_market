// 双向盲评（PRD 6.8）—— 挂载 /api：/projects/:id/reviews。
// 盲评规则：双方都提交后才同时 publishedAt；未发布前对方不可见；评价不可修改。
// Builder 信誉（ratingSum/ratingCount）在发布时刻累计，只算 CLIENT_TO_BUILDER 方向。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { PROJECT_STATUS, REVIEW_DIRECTION, REVIEW_DIMENSIONS } = require('../constants/marketplace');

const router = express.Router();

const REVIEW_SELECT = {
  id: true, projectId: true, authorId: true, targetId: true, direction: true,
  rating: true, communication: true, speed: true, codeQuality: true,
  aiSkill: true, delivery: true, comment: true, publishedAt: true, createdAt: true,
  author: { select: { id: true, name: true } },
};

const dim = z.number().int().min(1).max(5);
const reviewBodySchema = z.object({
  rating: dim,
  comment: z.string().trim().max(3000).optional(),
  communication: dim.optional(),
  speed: dim.optional(),
  codeQuality: dim.optional(),
  aiSkill: dim.optional(),
  delivery: dim.optional(),
});

// POST /api/projects/:id/reviews — 完成后的双方各评一次
router.post('/projects/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const body = reviewBodySchema.parse(req.body);
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, hiredBuilderId: true, status: true },
    });
    const isClient = p && p.clientId === req.userId;
    const isBuilder = p && p.hiredBuilderId === req.userId;
    if (!p || (!isClient && !isBuilder)) return res.status(404).json({ error: '任务不存在' });
    if (p.status !== PROJECT_STATUS.COMPLETED) {
      return res.status(409).json({ error: '任务完成后才能评价', code: 'NOT_COMPLETED' });
    }

    const direction = isClient ? REVIEW_DIRECTION.CLIENT_TO_BUILDER : REVIEW_DIRECTION.BUILDER_TO_CLIENT;
    const targetId = isClient ? p.hiredBuilderId : p.clientId;
    // 分维度仅客户评 Builder 时有效
    const dims = Object.fromEntries(
      REVIEW_DIMENSIONS.map((k) => [k, isClient ? body[k] ?? null : null]),
    );

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          projectId: p.id,
          authorId: req.userId,
          targetId,
          direction,
          rating: body.rating,
          comment: body.comment,
          ...dims,
        },
        select: REVIEW_SELECT,
      });

      // 对方已评 → 同时发布双方评价，并把客户评分计入 Builder 信誉
      const counterpart = await tx.review.findUnique({
        where: { projectId_authorId: { projectId: p.id, authorId: targetId } },
        select: { id: true, direction: true, rating: true, publishedAt: true },
      });
      if (counterpart && !counterpart.publishedAt) {
        const now = new Date();
        await tx.review.updateMany({
          where: { projectId: p.id },
          data: { publishedAt: now },
        });
        const clientReview = direction === REVIEW_DIRECTION.CLIENT_TO_BUILDER ? created : counterpart;
        await tx.builderProfile.update({
          where: { userId: p.hiredBuilderId },
          data: { ratingSum: { increment: clientReview.rating }, ratingCount: { increment: 1 } },
        });
        return { ...created, publishedAt: now };
      }
      return created;
    });
    res.status(201).json(review);
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '你已评价过该任务', code: 'ALREADY_REVIEWED' });
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/projects/:id/reviews — 已发布的评价对所有人可见；自己的未发布评价仅本人可见
router.get('/projects/:id/reviews', optionalAuth, async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, publishedAt: true },
    });
    if (!p || !p.publishedAt) return res.status(404).json({ error: '任务不存在' });

    const published = await prisma.review.findMany({
      where: { projectId: p.id, publishedAt: { not: null } },
      select: REVIEW_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    let myReview = published.find((r) => r.authorId === req.userId) || null;
    if (!myReview && req.userId) {
      myReview = await prisma.review.findUnique({
        where: { projectId_authorId: { projectId: p.id, authorId: req.userId } },
        select: REVIEW_SELECT,
      });
    }
    res.json({ items: published, myReview });
  } catch (e) { next(e); }
});

module.exports = router;
