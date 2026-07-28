// 后台：纠纷仲裁（PRD 6.6 —— V1 运营人工裁定：放款 / 全额退款 / 部分退款）
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAdmin, writeAdminLog, clientIp } = require('../middleware/admin');
const { DISPUTE_STATUS, ESCROW_STATUS, PROJECT_STATUS, round2 } = require('../constants/marketplace');
const { releaseInTx, refundInTx } = require('../services/escrow');

const router = express.Router();
router.use(requireAdmin);

function num(d) {
  return d == null ? null : Number(d);
}

const DISPUTE_INCLUDE = {
  escrow: {
    include: {
      project: { select: { id: true, title: true, status: true } },
      client: { select: { id: true, email: true, name: true } },
      builder: { select: { id: true, email: true, name: true } },
    },
  },
  raisedBy: { select: { id: true, email: true, name: true } },
};

function serialize(d) {
  return {
    ...d,
    refundAmount: num(d.refundAmount),
    escrow: d.escrow && {
      ...d.escrow,
      amount: num(d.escrow.amount),
      feeRate: num(d.escrow.feeRate),
      platformFee: num(d.escrow.platformFee),
      builderPayout: num(d.escrow.builderPayout),
    },
  };
}

const listSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// GET /api/admin/disputes — 默认列出待处理纠纷
router.get('/', async (req, res, next) => {
  try {
    const q = listSchema.parse(req.query);
    const status = q.status && DISPUTE_STATUS[q.status] ? q.status : DISPUTE_STATUS.OPEN;
    const where = { status };
    const [items, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: DISPUTE_INCLUDE,
        orderBy: { createdAt: 'asc' },   // 先到先裁
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.dispute.count({ where }),
    ]);
    res.json({ items: items.map(serialize), total, page: q.page, pageSize: q.pageSize });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: '参数不合法', code: 'INVALID' });
    next(e);
  }
});

const resolveSchema = z.object({
  action: z.enum(['RELEASE', 'REFUND', 'SPLIT']),
  resolution: z.string().trim().min(10).max(5000),
  refundAmount: z.number().positive().optional(),   // 仅 SPLIT：退给客户的金额
});

// POST /api/admin/disputes/:id/resolve — 裁定并执行资金流
router.post('/:id/resolve', async (req, res, next) => {
  try {
    const body = resolveSchema.parse(req.body);
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: { escrow: true },
    });
    if (!dispute) return res.status(404).json({ error: '纠纷不存在' });
    if (dispute.status !== DISPUTE_STATUS.OPEN) {
      return res.status(409).json({ error: '该纠纷已处理', code: 'ALREADY_RESOLVED' });
    }
    if (dispute.escrow.status !== ESCROW_STATUS.DISPUTED) {
      return res.status(409).json({ error: '托管单状态异常', code: 'BAD_ESCROW_STATE' });
    }
    const amount = Number(dispute.escrow.amount);
    if (body.action === 'SPLIT') {
      const r = round2(body.refundAmount ?? NaN);
      if (!(r > 0 && r < amount)) {
        return res.status(400).json({ error: '部分退款金额须大于 0 且小于成交金额', code: 'INVALID' });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.action === 'RELEASE') {
        await releaseInTx(tx, dispute.escrow);
      } else if (body.action === 'REFUND') {
        await refundInTx(tx, dispute.escrow);
      } else {
        await releaseInTx(tx, dispute.escrow, { releasedAmount: amount - round2(body.refundAmount) });
      }

      // 项目终态：放款/部分放款 = 完成；全额退款 = 取消
      const projectData = body.action === 'REFUND'
        ? { status: PROJECT_STATUS.CANCELLED, cancelledAt: new Date() }
        : { status: PROJECT_STATUS.COMPLETED, completedAt: new Date() };
      await tx.project.update({ where: { id: dispute.escrow.projectId }, data: projectData });
      if (body.action !== 'REFUND') {
        await tx.builderProfile.update({
          where: { userId: dispute.escrow.builderId },
          data: { completedCount: { increment: 1 } },
        });
      }

      const statusMap = {
        RELEASE: DISPUTE_STATUS.RESOLVED_RELEASE,
        REFUND: DISPUTE_STATUS.RESOLVED_REFUND,
        SPLIT: DISPUTE_STATUS.RESOLVED_SPLIT,
      };
      return tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: statusMap[body.action],
          resolution: body.resolution,
          refundAmount: body.action === 'SPLIT' ? round2(body.refundAmount) : null,
          resolvedById: req.admin.id,
          resolvedAt: new Date(),
        },
        include: DISPUTE_INCLUDE,
      });
    });

    await writeAdminLog({
      adminId: req.admin.id,
      action: 'dispute.resolve',
      targetType: 'Dispute',
      targetId: dispute.id,
      payload: { action: body.action, projectId: dispute.escrow.projectId, refundAmount: body.refundAmount ?? null },
      ip: clientIp(req),
    });
    res.json(serialize(updated));
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || '提交内容不合法', code: 'INVALID' });
    next(e);
  }
});

module.exports = router;
