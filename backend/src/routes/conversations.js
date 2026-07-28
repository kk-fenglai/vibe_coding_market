// 站内私信（PRD 6.5）—— 挂载 /api：/projects/:id/conversations 与 /conversations/*。
// 会话粒度 = (任务, Builder)：雇佣前客户可与多个申请人分别沟通。
// 消息是仲裁依据：软删除留痕；联系方式交换只标记 contactFlag，不拦截（PRD 5.3）。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { APPLICATION_STATUS } = require('../constants/marketplace');

const router = express.Router();

const PREVIEW_LEN = 120;

// 邮箱 / 连续 8 位以上数字（电话/QQ）/ 常见外联渠道关键词 → 运营可见的软标记
const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.]+/i,
  /\d{8,}/,
  /(微信|weixin|wechat|vx|whatsapp|telegram|t\.me|qq群|line id)/i,
];
function detectContact(text) {
  return CONTACT_PATTERNS.some((re) => re.test(text));
}

const CONV_INCLUDE = {
  project: { select: { id: true, title: true, status: true } },
  client: { select: { id: true, name: true } },
  builder: { select: { id: true, name: true } },
};

function serializeConv(c, userId) {
  const isClient = c.clientId === userId;
  return {
    id: c.id,
    projectId: c.projectId,
    project: c.project,
    counterpart: isClient ? c.builder : c.client,
    lastMessageAt: c.lastMessageAt,
    lastMessageText: c.lastMessageText,
    unread: isClient ? c.clientUnread : c.builderUnread,
  };
}

const openSchema = z.object({
  builderId: z.string().optional(),   // 客户发起时必填；Builder 发起时忽略
});

// POST /api/projects/:id/conversations — 打开（或复用）会话
router.post('/projects/:id/conversations', requireAuth, async (req, res, next) => {
  try {
    const { builderId: bodyBuilderId } = openSchema.parse(req.body ?? {});
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, hiredBuilderId: true, publishedAt: true },
    });
    if (!p || !p.publishedAt) return res.status(404).json({ error: '任务不存在' });

    const isClient = p.clientId === req.userId;
    const builderId = isClient ? bodyBuilderId : req.userId;
    if (!builderId || builderId === p.clientId) {
      return res.status(400).json({ error: '缺少会话对象', code: 'INVALID' });
    }

    // 只允许与「申请过（未撤回）或已受雇」的 Builder 建会话
    const isHired = p.hiredBuilderId === builderId;
    if (!isHired) {
      const applied = await prisma.application.findUnique({
        where: { projectId_builderId: { projectId: p.id, builderId } },
        select: { status: true },
      });
      if (!applied || applied.status === APPLICATION_STATUS.WITHDRAWN) {
        return res.status(403).json({ error: '仅任务申请人可与客户沟通', code: 'NOT_APPLICANT' });
      }
    }

    const conv = await prisma.conversation.upsert({
      where: { projectId_builderId: { projectId: p.id, builderId } },
      create: { projectId: p.id, clientId: p.clientId, builderId },
      update: {},
      include: CONV_INCLUDE,
    });
    res.status(201).json(serializeConv(conv, req.userId));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '参数不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/conversations — 我的会话列表（客户/Builder 双视角合并）
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.conversation.findMany({
      where: { OR: [{ clientId: req.userId }, { builderId: req.userId }] },
      include: CONV_INCLUDE,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json({ items: items.map((c) => serializeConv(c, req.userId)) });
  } catch (e) { next(e); }
});

async function loadConversation(id, userId) {
  const c = await prisma.conversation.findUnique({ where: { id }, include: CONV_INCLUDE });
  if (!c || (c.clientId !== userId && c.builderId !== userId)) return null;
  return c;
}

// GET /api/conversations/:id — 会话消息（进入即视为已读）
router.get('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const c = await loadConversation(req.params.id, req.userId);
    if (!c) return res.status(404).json({ error: '会话不存在' });

    const isClient = c.clientId === req.userId;
    const [messages] = await prisma.$transaction([
      prisma.message.findMany({
        where: { conversationId: c.id, deletedAt: null },
        select: {
          id: true, senderId: true, body: true, attachments: true,
          readAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      prisma.message.updateMany({
        where: { conversationId: c.id, senderId: { not: req.userId }, readAt: null },
        data: { readAt: new Date() },
      }),
      prisma.conversation.update({
        where: { id: c.id },
        data: isClient ? { clientUnread: 0 } : { builderUnread: 0 },
      }),
    ]);
    res.json({ conversation: serializeConv(c, req.userId), messages });
  } catch (e) { next(e); }
});

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

// POST /api/conversations/:id/messages — 发消息
router.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { body } = messageSchema.parse(req.body);
    const c = await loadConversation(req.params.id, req.userId);
    if (!c) return res.status(404).json({ error: '会话不存在' });

    const isClient = c.clientId === req.userId;
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: c.id,
          senderId: req.userId,
          body,
          contactFlag: detectContact(body),
        },
        select: { id: true, senderId: true, body: true, readAt: true, createdAt: true },
      }),
      prisma.conversation.update({
        where: { id: c.id },
        data: {
          lastMessageAt: new Date(),
          lastMessageText: body.slice(0, PREVIEW_LEN),
          ...(isClient ? { builderUnread: { increment: 1 } } : { clientUnread: { increment: 1 } }),
        },
      }),
    ]);
    res.status(201).json(message);
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '消息内容不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/conversations-unread — 导航栏未读角标
router.get('/conversations-unread', requireAuth, async (req, res, next) => {
  try {
    const [asClient, asBuilder] = await Promise.all([
      prisma.conversation.aggregate({
        where: { clientId: req.userId },
        _sum: { clientUnread: true },
      }),
      prisma.conversation.aggregate({
        where: { builderId: req.userId },
        _sum: { builderUnread: true },
      }),
    ]);
    res.json({ unread: (asClient._sum.clientUnread || 0) + (asBuilder._sum.builderUnread || 0) });
  } catch (e) { next(e); }
});

module.exports = router;
