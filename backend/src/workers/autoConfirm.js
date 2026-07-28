// 交付后客户超时未验收 → 自动确认放款（PRD 6.6，AUTO_CONFIRM_DAYS 见 constants/marketplace.js）。
// 扫描 HELD 且 autoConfirmAt 已过期的托管单，逐单走与手动验收相同的完成+放款事务。
const prisma = require('../prisma');
const { logger } = require('../utils/logger');
const { ESCROW_STATUS, PROJECT_STATUS } = require('../constants/marketplace');
const { completeProjectWithRelease } = require('../services/escrow');

const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 每小时

async function scanOnce() {
  const due = await prisma.escrowTransaction.findMany({
    where: {
      status: ESCROW_STATUS.HELD,
      autoConfirmAt: { lte: new Date() },
      project: { status: PROJECT_STATUS.REVIEW },
    },
    select: { id: true, projectId: true },
    take: 100,
  });
  for (const escrow of due) {
    try {
      await completeProjectWithRelease(escrow.projectId);
      logger.info({ projectId: escrow.projectId, escrowId: escrow.id }, 'autoConfirm: released');
    } catch (e) {
      // 单笔失败不影响其余（例如恰好被客户手动验收/打回，状态检查会抛 409）
      logger.warn({ projectId: escrow.projectId, err: e.message }, 'autoConfirm: skipped');
    }
  }
  return due.length;
}

function start() {
  scanOnce().catch((e) => logger.error({ err: e }, 'autoConfirm: initial scan failed'));
  const timer = setInterval(() => {
    scanOnce().catch((e) => logger.error({ err: e }, 'autoConfirm: scan failed'));
  }, SCAN_INTERVAL_MS);
  timer.unref(); // 不阻塞进程优雅退出
  logger.info({ intervalMs: SCAN_INTERVAL_MS }, 'autoConfirm worker started');
  return timer;
}

module.exports = { start, scanOnce };
