// 托管资金流（PRD 6.6 / 5.1 / 5.3）—— V1 provider = MOCK：钱包流水模拟，不动真钱。
// 资金状态机：PENDING（下单未付）→ HELD（托管中）→ RELEASED / REFUNDED；HELD ↔ DISPUTED。
// 所有变更走交互式事务，入口处复查状态防并发；账本只追加（WalletLedger）。
const prisma = require('../prisma');
const {
  ESCROW_STATUS, PROJECT_STATUS, LEDGER_TYPE,
  FEE_RATE_DEFAULT, FEE_RATE_REPEAT, AUTO_CONFIRM_DAYS,
  round2, splitFee, canTransition,
} = require('../constants/marketplace');

// 同一「客户 ↔ Builder」有过成功放款 → 复购费率（PRD 5.3）
async function resolveFeeRate(clientId, builderId) {
  const prior = await prisma.escrowTransaction.count({
    where: { clientId, builderId, status: ESCROW_STATUS.RELEASED },
  });
  return prior > 0 ? FEE_RATE_REPEAT : FEE_RATE_DEFAULT;
}

// 录用时在 accept 事务里创建托管单（PENDING，等客户付款）。
// tx = 事务客户端；feeRate 需在事务外用 resolveFeeRate 先算好。
function createEscrowForHire(tx, { projectId, clientId, builderId, amount, currency, feeRate }) {
  const { platformFee, builderPayout } = splitFee(amount, feeRate);
  return tx.escrowTransaction.create({
    data: {
      projectId, clientId, builderId,
      amount: round2(amount), currency,
      feeRate, platformFee, builderPayout,
      status: ESCROW_STATUS.PENDING,
    },
  });
}

async function getOrCreateWallet(tx, userId, currency) {
  const existing = await tx.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.wallet.create({ data: { userId, currency } });
}

// POST 客户付款（MOCK：外部支付成功视角，资金进入平台托管）：PENDING → HELD
async function fundEscrow(escrowId, clientId) {
  return prisma.$transaction(async (tx) => {
    const escrow = await tx.escrowTransaction.findUnique({ where: { id: escrowId } });
    if (!escrow || escrow.clientId !== clientId) throw httpError(404, '托管单不存在');
    if (escrow.status !== ESCROW_STATUS.PENDING) throw httpError(409, '托管单已付款或已关闭', 'BAD_ESCROW_STATE');

    const amount = Number(escrow.amount);
    const wallet = await getOrCreateWallet(tx, clientId, escrow.currency);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { held: { increment: amount } },
    });
    await tx.walletLedger.create({
      data: {
        userId: clientId, type: LEDGER_TYPE.ESCROW_HOLD,
        amount, balanceAfter: wallet.balance, currency: escrow.currency,
        escrowId: escrow.id, note: '托管付款（MOCK）',
      },
    });
    return tx.escrowTransaction.update({
      where: { id: escrow.id },
      data: { status: ESCROW_STATUS.HELD, fundedAt: new Date() },
    });
  });
}

// 放款：HELD/DISPUTED → RELEASED。
// releasedAmount 缺省 = 全额；SPLIT 裁定时传部分金额，其余走退款行。
async function releaseInTx(tx, escrow, { releasedAmount } = {}) {
  const total = Number(escrow.amount);
  const released = round2(releasedAmount ?? total);
  const refunded = round2(total - released);
  const { platformFee, builderPayout } = splitFee(released, Number(escrow.feeRate));

  // 客户侧：托管资金全部离开 held（放款部分 + 退款部分）
  const clientWallet = await getOrCreateWallet(tx, escrow.clientId, escrow.currency);
  await tx.wallet.update({ where: { id: clientWallet.id }, data: { held: { decrement: total } } });
  await tx.walletLedger.create({
    data: {
      userId: escrow.clientId, type: LEDGER_TYPE.ESCROW_RELEASE,
      amount: -released, balanceAfter: clientWallet.balance, currency: escrow.currency,
      escrowId: escrow.id, note: '托管放款给 Builder',
    },
  });
  if (refunded > 0) {
    await tx.walletLedger.create({
      data: {
        userId: escrow.clientId, type: LEDGER_TYPE.REFUND,
        amount: -refunded, balanceAfter: clientWallet.balance, currency: escrow.currency,
        escrowId: escrow.id, note: '部分退款（MOCK 原路退回）',
      },
    });
  }

  // Builder 侧：全额入账 → 扣平台费，净得 builderPayout
  const builderWallet = await getOrCreateWallet(tx, escrow.builderId, escrow.currency);
  const afterGross = round2(Number(builderWallet.balance) + released);
  const afterNet = round2(afterGross - platformFee);
  await tx.wallet.update({ where: { id: builderWallet.id }, data: { balance: afterNet } });
  await tx.walletLedger.create({
    data: {
      userId: escrow.builderId, type: LEDGER_TYPE.ESCROW_RELEASE,
      amount: released, balanceAfter: afterGross, currency: escrow.currency,
      escrowId: escrow.id, note: '托管放款到账',
    },
  });
  await tx.walletLedger.create({
    data: {
      userId: escrow.builderId, type: LEDGER_TYPE.PLATFORM_FEE,
      amount: -platformFee, balanceAfter: afterNet, currency: escrow.currency,
      escrowId: escrow.id, note: `平台服务费 ${(Number(escrow.feeRate) * 100).toFixed(0)}%`,
    },
  });

  await tx.builderProfile.update({
    where: { userId: escrow.builderId },
    data: { totalEarned: { increment: builderPayout } },
  });

  const now = new Date();
  return tx.escrowTransaction.update({
    where: { id: escrow.id },
    data: {
      status: ESCROW_STATUS.RELEASED,
      platformFee, builderPayout,
      releasedAt: now,
      ...(refunded > 0 ? { refundedAt: now } : {}),
    },
  });
}

// 退款：HELD/DISPUTED → REFUNDED（MOCK 原路退回，held 清空）
async function refundInTx(tx, escrow) {
  const total = Number(escrow.amount);
  const clientWallet = await getOrCreateWallet(tx, escrow.clientId, escrow.currency);
  await tx.wallet.update({ where: { id: clientWallet.id }, data: { held: { decrement: total } } });
  await tx.walletLedger.create({
    data: {
      userId: escrow.clientId, type: LEDGER_TYPE.REFUND,
      amount: -total, balanceAfter: clientWallet.balance, currency: escrow.currency,
      escrowId: escrow.id, note: '全额退款（MOCK 原路退回）',
    },
  });
  return tx.escrowTransaction.update({
    where: { id: escrow.id },
    data: { status: ESCROW_STATUS.REFUNDED, refundedAt: new Date() },
  });
}

// 验收完成：项目 REVIEW → COMPLETED + 放款 + Builder 完成数 +1。
// 客户手动验收（routes/projects.js confirm）与超时自动确认（workers/autoConfirm.js）共用。
async function completeProjectWithRelease(projectId, { requireClientId } = {}) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, status: true, hiredBuilderId: true, escrow: true },
    });
    if (!p || (requireClientId && p.clientId !== requireClientId)) throw httpError(404, '任务不存在');
    if (!canTransition(p.status, PROJECT_STATUS.COMPLETED)) throw httpError(409, '当前状态不能验收', 'BAD_TRANSITION');
    if (p.escrow && p.escrow.status === ESCROW_STATUS.DISPUTED) {
      throw httpError(409, '存在进行中的纠纷，请等待仲裁结果', 'DISPUTE_OPEN');
    }

    if (p.escrow && p.escrow.status === ESCROW_STATUS.HELD) {
      await releaseInTx(tx, p.escrow);
    }
    await tx.builderProfile.update({
      where: { userId: p.hiredBuilderId },
      data: { completedCount: { increment: 1 } },
    });
    return tx.project.update({
      where: { id: p.id },
      data: { status: PROJECT_STATUS.COMPLETED, completedAt: new Date() },
    });
  });
}

// 交付成功后启动自动确认倒计时（routes/projects.js deliver 调用）
function autoConfirmDeadline(from = new Date()) {
  return new Date(from.getTime() + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000);
}

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

module.exports = {
  resolveFeeRate,
  createEscrowForHire,
  fundEscrow,
  releaseInTx,
  refundInTx,
  completeProjectWithRelease,
  autoConfirmDeadline,
  httpError,
};
