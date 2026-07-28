// Builder 资料（PRD 6.9 / 7.1）+ 作品集（6.10）+ 公开主页。
// 建了资料才能申请任务（见 routes/applications.js）；
// 认证审核（verified）走 routes/adminBuilders.js，信誉指标由服务层维护。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { AI_TOOLS, REVIEW_DIRECTION } = require('../constants/marketplace');

const router = express.Router();

const PROFILE_SELECT = {
  id: true, headline: true, bio: true, country: true, languages: true,
  skills: true, aiTools: true, githubUrl: true, websiteUrl: true, avatarUrl: true,
  verified: true, completedCount: true, ratingSum: true, ratingCount: true,
  createdAt: true, updatedAt: true,
};

const profileBodySchema = z.object({
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(5000).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  languages: z.array(z.string().trim().min(2).max(10)).max(5).default([]),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  aiTools: z.array(z.enum(AI_TOOLS)).max(AI_TOOLS.length).default([]),
  githubUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  websiteUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  avatarUrl: z.string().trim().url().max(1000).optional().or(z.literal('')),
});

// GET /api/builders/me — 自己的 Builder 资料；未建过返回 { profile: null }
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await prisma.builderProfile.findUnique({
      where: { userId: req.userId },
      select: PROFILE_SELECT,
    });
    res.json({ profile });
  } catch (e) { next(e); }
});

// PUT /api/builders/me — 创建或更新资料（upsert）
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const body = profileBodySchema.parse(req.body);
    const data = {
      ...body,
      githubUrl: body.githubUrl || null,
      websiteUrl: body.websiteUrl || null,
      avatarUrl: body.avatarUrl || null,
    };
    const profile = await prisma.builderProfile.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, ...data },
      update: data,
      select: PROFILE_SELECT,
    });
    res.json({ profile });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 作品集（PRD 6.10）—— 自助管理；关联平台内已完成任务的条目带「真实交付」标识
// ─────────────────────────────────────────────────────────────────────────────
const PORTFOLIO_SELECT = {
  id: true, title: true, summary: true, imageUrl: true, demoUrl: true,
  repoUrl: true, figmaUrl: true, videoUrl: true, projectId: true,
  sortOrder: true, createdAt: true,
};

const urlField = z.string().trim().url().max(1000).optional().or(z.literal(''));
const portfolioBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(2000).optional(),
  imageUrl: urlField,
  demoUrl: urlField,
  repoUrl: urlField,
  figmaUrl: urlField,
  videoUrl: urlField,
  sortOrder: z.number().int().min(0).max(999).default(0),
});

function normalizePortfolio(body) {
  const urls = ['imageUrl', 'demoUrl', 'repoUrl', 'figmaUrl', 'videoUrl'];
  const out = { ...body };
  urls.forEach((k) => { out[k] = body[k] || null; });
  return out;
}

async function requireOwnProfile(req, res) {
  const profile = await prisma.builderProfile.findUnique({
    where: { userId: req.userId },
    select: { id: true },
  });
  if (!profile) {
    res.status(403).json({ error: '请先创建 Builder 资料', code: 'NO_BUILDER_PROFILE' });
    return null;
  }
  return profile;
}

// POST /api/builders/me/portfolio — 新增作品
router.post('/me/portfolio', requireAuth, async (req, res, next) => {
  try {
    const profile = await requireOwnProfile(req, res);
    if (!profile) return;
    const body = normalizePortfolio(portfolioBodySchema.parse(req.body));
    const item = await prisma.portfolioItem.create({
      data: { ...body, builderId: profile.id },
      select: PORTFOLIO_SELECT,
    });
    res.status(201).json(item);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// PATCH /api/builders/me/portfolio/:id — 编辑作品
router.patch('/me/portfolio/:id', requireAuth, async (req, res, next) => {
  try {
    const profile = await requireOwnProfile(req, res);
    if (!profile) return;
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: req.params.id },
      select: { id: true, builderId: true },
    });
    if (!existing || existing.builderId !== profile.id) return res.status(404).json({ error: '作品不存在' });
    const body = normalizePortfolio(portfolioBodySchema.parse(req.body));
    const item = await prisma.portfolioItem.update({
      where: { id: existing.id },
      data: body,
      select: PORTFOLIO_SELECT,
    });
    res.json(item);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// DELETE /api/builders/me/portfolio/:id — 删除作品
router.delete('/me/portfolio/:id', requireAuth, async (req, res, next) => {
  try {
    const profile = await requireOwnProfile(req, res);
    if (!profile) return;
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: req.params.id },
      select: { id: true, builderId: true },
    });
    if (!existing || existing.builderId !== profile.id) return res.status(404).json({ error: '作品不存在' });
    await prisma.portfolioItem.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/builders/me/portfolio — 自己的作品列表
router.get('/me/portfolio', requireAuth, async (req, res, next) => {
  try {
    const profile = await requireOwnProfile(req, res);
    if (!profile) return;
    const items = await prisma.portfolioItem.findMany({
      where: { builderId: profile.id },
      select: PORTFOLIO_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 公开 Builder 主页（PRD 6.9）—— 资料 + 作品集 + 已发布评价。放在 /me 之后避免吞路由。
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:userId', async (req, res, next) => {
  try {
    const profile = await prisma.builderProfile.findUnique({
      where: { userId: req.params.userId },
      select: {
        headline: true, bio: true, country: true, languages: true, skills: true,
        aiTools: true, githubUrl: true, websiteUrl: true, avatarUrl: true,
        verified: true, completedCount: true, ratingSum: true, ratingCount: true,
        avgDeliveryHours: true, totalEarned: true, showEarnings: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        portfolio: {
          select: PORTFOLIO_SELECT,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Builder 不存在' });

    const reviews = await prisma.review.findMany({
      where: {
        targetId: req.params.userId,
        direction: REVIEW_DIRECTION.CLIENT_TO_BUILDER,
        publishedAt: { not: null },
      },
      select: {
        id: true, rating: true, comment: true, publishedAt: true,
        communication: true, speed: true, codeQuality: true, aiSkill: true, delivery: true,
        author: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    const { totalEarned, showEarnings, user, ...rest } = profile;
    res.json({
      profile: {
        ...rest,
        userId: user.id,
        name: user.name,
        ...(showEarnings ? { totalEarned: Number(totalEarned) } : {}),
      },
      reviews,
    });
  } catch (e) { next(e); }
});

module.exports = router;
