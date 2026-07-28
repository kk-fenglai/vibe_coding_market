// Single source of truth for marketplace enums, state machine and money rules.
// Prisma stores these as plain strings (same style as User.role/status), so any
// validation MUST go through this file — never hardcode a status literal in a route.
//
// Used by: routes/projects.js · routes/applications.js · routes/escrow.js
//          services/escrow.js · workers/autoConfirm.js · frontend (echoed via API)

// ─── 任务状态机 (PRD 6.7) ────────────────────────────────────────────────────
const PROJECT_STATUS = {
  DRAFT: 'DRAFT',                   // 客户编辑中
  PENDING_REVIEW: 'PENDING_REVIEW', // 提交后进入人工审核队列 (6.1)
  REJECTED: 'REJECTED',             // 审核不通过
  OPEN: 'OPEN',                     // 已上架，可申请
  IN_PROGRESS: 'IN_PROGRESS',       // 已雇佣 + 托管已付款
  REVIEW: 'REVIEW',                 // Builder 已交付，等客户确认
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// 允许的状态跃迁；服务层每次改 status 前必须查这张表。
const PROJECT_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['OPEN', 'REJECTED', 'CANCELLED'],
  REJECTED: ['PENDING_REVIEW', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REVIEW', 'CANCELLED'],
  REVIEW: ['COMPLETED', 'IN_PROGRESS'], // 打回返工 → IN_PROGRESS
  COMPLETED: [],
  CANCELLED: [],
};

function canTransition(from, to) {
  return (PROJECT_TRANSITIONS[from] || []).includes(to);
}

// ─── 任务属性 (PRD 6.1) ──────────────────────────────────────────────────────
const PROJECT_CATEGORIES = [
  'LANDING',    // Landing Page
  'AI_SAAS',    // AI SaaS 产品
  'DASHBOARD',  // 后台 / Dashboard
  'CORPORATE',  // 企业官网
  'BLOG',
  'MVP',
  'CMS',
  'ECOMMERCE',
  'RESCUE',     // Lovable/Bolt 半成品救援 (PRD 2.3)
  'OTHER',
];

const DELIVERY_DAYS = [1, 3, 7, 14];
const CURRENCIES = ['CNY', 'USD', 'EUR'];

// ─── 申请 (PRD 6.3) ──────────────────────────────────────────────────────────
const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

// 申请数上限，保证客户筛选体验；Builder Pro 优先展示是 V1.5。
const MAX_APPLICATIONS_PER_PROJECT = 15;

// ─── 托管支付 (PRD 6.6) ──────────────────────────────────────────────────────
const ESCROW_STATUS = {
  PENDING: 'PENDING',   // 已下单未付款
  HELD: 'HELD',         // 平台托管中
  DISPUTED: 'DISPUTED',
  RELEASED: 'RELEASED', // 已打款给 Builder（抽佣已扣）
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
};

const DISPUTE_STATUS = {
  OPEN: 'OPEN',
  RESOLVED_RELEASE: 'RESOLVED_RELEASE', // 判给 Builder
  RESOLVED_REFUND: 'RESOLVED_REFUND',   // 全额退客户
  RESOLVED_SPLIT: 'RESOLVED_SPLIT',     // 部分退款
  WITHDRAWN: 'WITHDRAWN',
};

const LEDGER_TYPE = {
  DEPOSIT: 'DEPOSIT',
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  PLATFORM_FEE: 'PLATFORM_FEE',
  REFUND: 'REFUND',
  WITHDRAWAL: 'WITHDRAWAL',
};

// ┌────────────────────────────────────────────────────────────────────────┐
// │ ★ 费率切口 (PRD 5.1 / 5.3)：改抽佣只动这里。                            │
// │   同一「客户 ↔ Builder」的复购单降到 REPEAT 费率，压缩逃单动机。        │
// └────────────────────────────────────────────────────────────────────────┘
const FEE_RATE_DEFAULT = 0.10;
const FEE_RATE_REPEAT = 0.05;

// 交付后 N 天客户未确认则自动确认放款（worker 扫 EscrowTransaction.autoConfirmAt）。
const AUTO_CONFIRM_DAYS = 7;

// 金额一律 2 位小数，四舍五入后再写库（Decimal(12,2)）。
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// 抽佣拆分：平台费向上取到分，Builder 拿差额，保证 fee + payout === amount。
function splitFee(amount, feeRate) {
  const total = round2(amount);
  const platformFee = round2(total * feeRate);
  return { amount: total, platformFee, builderPayout: round2(total - platformFee) };
}

// ─── Builder 资料 (PRD 7.1) ──────────────────────────────────────────────────
const AI_TOOLS = [
  'CURSOR',
  'CLAUDE_CODE',
  'LOVABLE',
  'BOLT',
  'V0',
  'WINDSURF',
  'REPLIT_AGENT',
];

// ─── 评价 (PRD 6.8) ──────────────────────────────────────────────────────────
const REVIEW_DIRECTION = {
  CLIENT_TO_BUILDER: 'CLIENT_TO_BUILDER',
  BUILDER_TO_CLIENT: 'BUILDER_TO_CLIENT',
};
// 客户评 Builder 的分维度；Builder 评客户只给总分 + 评论。
const REVIEW_DIMENSIONS = ['communication', 'speed', 'codeQuality', 'aiSkill', 'delivery'];

module.exports = {
  PROJECT_STATUS,
  PROJECT_TRANSITIONS,
  canTransition,
  PROJECT_CATEGORIES,
  DELIVERY_DAYS,
  CURRENCIES,
  APPLICATION_STATUS,
  MAX_APPLICATIONS_PER_PROJECT,
  ESCROW_STATUS,
  DISPUTE_STATUS,
  LEDGER_TYPE,
  FEE_RATE_DEFAULT,
  FEE_RATE_REPEAT,
  AUTO_CONFIRM_DAYS,
  round2,
  splitFee,
  AI_TOOLS,
  REVIEW_DIRECTION,
  REVIEW_DIMENSIONS,
};
