export type Plan = 'FREE' | 'STANDARD' | 'AI' | 'AI_UNLIMITED';

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: Plan;
  effectivePlan?: Plan;
  subscriptionEnd?: string | null;
}

// BuilderHub marketplace 类型 —— 后续阶段在此追加
// (Application / BuilderProfile / EscrowTransaction / Review / Conversation ...)
// 常量与后端 constants/marketplace.js 一一对应，改档位要两边一起改。

export const PROJECT_CATEGORIES = [
  'LANDING', 'AI_SAAS', 'DASHBOARD', 'CORPORATE', 'BLOG',
  'MVP', 'CMS', 'ECOMMERCE', 'RESCUE', 'OTHER',
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_STATUSES = [
  'DRAFT', 'PENDING_REVIEW', 'REJECTED', 'OPEN',
  'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DELIVERY_DAYS = [1, 3, 7, 14] as const;
export const CURRENCIES = ['CNY', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface ProjectAttachment {
  name: string;
  url: string;
  type?: string;
}

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: Currency;
  deliveryDays: number;
  urgent: boolean;
  tags: string[];
  stackPref: string[];
  languageReq?: string | null;
  status: ProjectStatus;
  applicationCount: number;
  publishedAt?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
  completedAt?: string | null;
  client?: { id: string; name?: string | null };
  hasApplied?: boolean;
  // 详情接口才返回
  description?: string;
  attachments?: ProjectAttachment[] | null;
  dueAt?: string | null;
  deliveryNote?: string | null;
  reviewNote?: string | null;
  isOwner?: boolean;
  isHiredBuilder?: boolean;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── 申请接单 / Builder 资料（与 constants/marketplace.js 对应）───────────────

export const APPLICATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const AI_TOOLS = [
  'CURSOR', 'CLAUDE_CODE', 'LOVABLE', 'BOLT', 'V0', 'WINDSURF', 'REPLIT_AGENT',
] as const;
export type AiTool = (typeof AI_TOOLS)[number];

export interface Application {
  id: string;
  projectId: string;
  builderId: string;
  bidAmount: number;
  currency: Currency;
  estimatedDays: number;
  pitch: string;
  portfolioUrl?: string | null;
  status: ApplicationStatus;
  respondedAt?: string | null;
  createdAt: string;
  // 业主视角：申请人概要
  builder?: {
    id: string;
    name?: string | null;
    builderProfile?: {
      headline?: string | null;
      skills: string[];
      aiTools: string[];
      verified: boolean;
      completedCount: number;
      ratingSum: number;
      ratingCount: number;
    } | null;
  };
  // Builder 视角：任务概要
  project?: Pick<Project, 'id' | 'title' | 'category' | 'status' | 'currency' | 'budgetMin' | 'budgetMax' | 'deliveryDays'>;
}

export interface ApplicationPayload {
  bidAmount: number;
  estimatedDays: number;
  pitch: string;
  portfolioUrl?: string;
}

export interface BuilderProfile {
  id: string;
  headline?: string | null;
  bio?: string | null;
  country?: string | null;
  languages: string[];
  skills: string[];
  aiTools: AiTool[];
  githubUrl?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  completedCount: number;
  ratingSum: number;
  ratingCount: number;
}

export interface BuilderProfilePayload {
  headline?: string;
  bio?: string;
  country?: string;
  languages: string[];
  skills: string[];
  aiTools: AiTool[];
  githubUrl?: string;
  websiteUrl?: string;
  avatarUrl?: string;
}

// ─── 托管支付 / 评价 / 私信 / 作品集（与 constants/marketplace.js 对应）──────

export const ESCROW_STATUSES = ['PENDING', 'HELD', 'DISPUTED', 'RELEASED', 'REFUNDED', 'CANCELLED'] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export interface Dispute {
  id: string;
  raisedById: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED_RELEASE' | 'RESOLVED_REFUND' | 'RESOLVED_SPLIT' | 'WITHDRAWN';
  resolution?: string | null;
  refundAmount?: number | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface Escrow {
  id: string;
  projectId: string;
  clientId: string;
  builderId: string;
  amount: number;
  currency: Currency;
  feeRate: number;
  platformFee: number;
  builderPayout: number;
  status: EscrowStatus;
  fundedAt?: string | null;
  autoConfirmAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  dispute?: Dispute | null;
}

export interface WalletInfo {
  wallet: { currency: string; balance: number; held: number };
  ledger: {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    currency: string;
    note?: string | null;
    createdAt: string;
  }[];
}

export interface Review {
  id: string;
  projectId: string;
  authorId: string;
  targetId: string;
  direction: 'CLIENT_TO_BUILDER' | 'BUILDER_TO_CLIENT';
  rating: number;
  communication?: number | null;
  speed?: number | null;
  codeQuality?: number | null;
  aiSkill?: number | null;
  delivery?: number | null;
  comment?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  author?: { id: string; name?: string | null };
  project?: { id: string; title: string };
}

export interface ReviewPayload {
  rating: number;
  comment?: string;
  communication?: number;
  speed?: number;
  codeQuality?: number;
  aiSkill?: number;
  delivery?: number;
}

export interface Conversation {
  id: string;
  projectId: string;
  project?: { id: string; title: string; status: ProjectStatus };
  counterpart?: { id: string; name?: string | null };
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  unread: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  demoUrl?: string | null;
  repoUrl?: string | null;
  figmaUrl?: string | null;
  videoUrl?: string | null;
  projectId?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface PortfolioPayload {
  title: string;
  summary?: string;
  imageUrl?: string;
  demoUrl?: string;
  repoUrl?: string;
  figmaUrl?: string;
  videoUrl?: string;
  sortOrder?: number;
}

export interface PublicBuilderProfile {
  userId: string;
  name?: string | null;
  headline?: string | null;
  bio?: string | null;
  country?: string | null;
  languages: string[];
  skills: string[];
  aiTools: string[];
  githubUrl?: string | null;
  websiteUrl?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  completedCount: number;
  ratingSum: number;
  ratingCount: number;
  avgDeliveryHours?: number | null;
  totalEarned?: number;
  createdAt: string;
  portfolio: PortfolioItem[];
}

// 发布/编辑任务的表单载荷
export interface ProjectPayload {
  title: string;
  description: string;
  category: ProjectCategory;
  budgetMin?: number;
  budgetMax?: number;
  currency: Currency;
  deliveryDays: number;
  urgent: boolean;
  languageReq?: string;
  stackPref: string[];
  tags: string[];
  attachments: ProjectAttachment[];
}
