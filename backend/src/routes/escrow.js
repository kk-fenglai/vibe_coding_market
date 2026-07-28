// 托管支付（PRD 6.6）—— 挂载 /api：/projects/:id/escrow/* 与 /wallet。
// V1 MOCK：付款按钮即视为外部支付成功；接 Stripe Connect 时换 services/escrow 的实现。
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { ESCROW_STATUS, DISPUTE_STATUS } = require('../constants/marketplace');
const { fundEscrow } = require('../services/escrow');

const router = express.Router();

function num(d) {
  return d == null ? null : Number(d);
}

function serializeEscrow(e) {
  if (!e) return e;
  return {
    ...e,
    amount: num(e.amount),
    feeRate: num(e.feeRate),
    platformFee: num(e.platformFee),
    builderPayout: num(e.builderPayout),
    ...(e.dispute ? { dispute: { ...e.dispute, refundAmount: num(e.dispute.refundAmount) } } : {}),
  };
}

async function loadEscrowForParticipant(projectId, userId) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { projectId },
    include: { dispute: true },
  });
  if (!escrow || (escrow.clientId !== userId && escrow.builderId !== userId)) return null;
  return escrow;
}

// GET /api/projects/:id/escrow — 双方查看托管状态（含纠纷）
router.get('/projects/:id/escrow', requireAuth, async (req, res, next) => {
  try {
    const escrow = await loadEscrowForParticipant(req.params.id, req.userId);
    if (!escrow) return res.status(404).json({ error: '托管单不存在' });
    res.json(serializeEscrow(escrow));
  } catch (e) { next(e); }
});

// POST /api/projects/:id/escrow/fund — 客户托管付款（MOCK）
router.post('/projects/:id/escrow/fund', requireAuth, async (req, res, next) => {
  try {
    const escrow = await prisma.escrowTransaction.findUnique({
      where: { projectId: req.params.id },
      select: { id: true, clientId: true },
    });
    if (!escrow || escrow.clientId !== req.userId) return res.status(404).json({ error: '托管单不存在' });
    const funded = await fundEscrow(escrow.id, req.userId);
    res.json(serializeEscrow(funded));
  } catch (e) { next(e); }
});

const disputeSchema = z.object({
  reason: z.string().trim().min(20).max(5000),
});

// POST /api/projects/:id/escrow/dispute — 托管中任一方发起纠纷 → 运营仲裁
router.post('/projects/:id/escrow/dispute', requireAuth, async (req, res, next) => {
  try {
    const { reason } = disputeSchema.parse(req.body);
    const escrow = await loadEscrowForParticipant(req.params.id, req.userId);
    if (!escrow) return res.status(404).json({ error: '托管单不存在' });
    if (escrow.status !== ESCROW_STATUS.HELD) {
      return res.status(409).json({ error: '仅托管中的订单可发起纠纷', code: 'BAD_ESCROW_STATE' });
    }
    const [, updated] = await prisma.$transaction([
      prisma.dispute.create({
        data: {
          escrowId: escrow.id,
          raisedById: req.userId,
          reason,
          status: DISPUTE_STATUS.OPEN,
        },
      }),
      prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: ESCROW_STATUS.DISPUTED },
        include: { dispute: true },
      }),
    ]);
    res.status(201).json(serializeEscrow(updated));
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '该订单已有纠纷记录', code: 'DISPUTE_EXISTS' });
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

// GET /api/wallet — 我的钱包与最近流水
router.get('/wallet', requireAuth, async (req, res, next) => {
  try {
    const [wallet, ledger] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: req.userId } }),
      prisma.walletLedger.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({
      wallet: wallet
        ? { currency: wallet.currency, balance: num(wallet.balance), held: num(wallet.held) }
        : { currency: 'CNY', balance: 0, held: 0 },
      ledger: ledger.map((l) => ({
        ...l, amount: num(l.amount), balanceAfter: num(l.balanceAfter),
      })),
    });
  } catch (e) { next(e); }
});

module.exports = router;
