// Seed: BuilderHub bootstrap data.
//
// Safety:
//   - The admin user is always upserted (needed for first deploy on any env).
//   - Demo accounts are only created in NON-production environments
//     unless you explicitly set ALLOW_PROD_SEED=true.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_PROD_SEED = process.env.ALLOW_PROD_SEED === 'true';

async function main() {
  console.log(`🌱 Seeding database (NODE_ENV=${process.env.NODE_ENV || 'development'})...`);

  // ---- Super Admin — always ensure exists ----
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminInitialPwd = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe$Admin@2026!Prod';
  if (IS_PROD && !process.env.ADMIN_INITIAL_PASSWORD) {
    console.warn('⚠️  ADMIN_INITIAL_PASSWORD not set — using default. Change it immediately after first login.');
  }
  const adminPwdHash = await bcrypt.hash(adminInitialPwd, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPwdHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Super admin ready: ${ADMIN_EMAIL}`);
  console.log('⚠️  Change this password IMMEDIATELY after first login!');

  // ---- Demo users — dev/staging only ----
  if (IS_PROD && !ALLOW_PROD_SEED) {
    console.log('⏭️  Skipping demo users (NODE_ENV=production).');
    return;
  }

  const demoPwd = await bcrypt.hash('demo1234', 12);
  // Client demo account (posts projects).
  const client = await prisma.user.upsert({
    where: { email: 'client@builderhub.dev' },
    update: { emailVerified: true },
    create: {
      email: 'client@builderhub.dev',
      passwordHash: demoPwd,
      name: 'Demo Client',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  // Builder demo account (applies to projects).
  const builder = await prisma.user.upsert({
    where: { email: 'builder@builderhub.dev' },
    update: { emailVerified: true },
    create: {
      email: 'builder@builderhub.dev',
      passwordHash: demoPwd,
      name: 'Alex Chen',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Demo users ready: client@builderhub.dev / builder@builderhub.dev (password: demo1234)');

  // ---- Demo builder profile ----
  const builderProfile = await prisma.builderProfile.upsert({
    where: { userId: builder.id },
    update: {},
    create: {
      userId: builder.id,
      headline: 'Cursor + Next.js，48h 交付 Landing Page',
      bio: '专注用 AI 工具链快速交付 Web 项目：擅长把 Figma / PRD 转成可上线的 Next.js 站点，重视干净的代码和高效架构。',
      country: 'CN',
      languages: ['zh', 'en'],
      skills: ['React', 'Next.js', 'Tailwind', 'Node.js', 'LangChain', 'Supabase'],
      aiTools: ['CURSOR', 'CLAUDE_CODE', 'V0'],
      githubUrl: 'https://github.com/example',
      verified: true,
      verifiedAt: new Date(),
      completedCount: 1,
      ratingSum: 5,
      ratingCount: 1,
      totalEarned: 3200,
      showEarnings: true,
    },
  });

  // ---- Demo projects — skip if the demo client already has any ----
  const existing = await prisma.project.count({ where: { clientId: client.id } });
  if (existing > 0) {
    console.log(`⏭️  Demo projects already exist (${existing}), skipping.`);
    return;
  }

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const openProjects = [
    {
      title: '智能客服 AI Agent（对接 Shopify + Zendesk）',
      description: '需要一位全栈开发者构建 AI 客服 Agent：\n\n- 对接 Shopify 订单数据与 Zendesk 工单\n- 自动处理退货、FAQ 与订单查询\n- 支持中英双语，复杂问题转人工\n- 需要评估 RAG 方案与向量库选型',
      category: 'AI_SAAS', budgetMin: 2500, budgetMax: 4000, currency: 'USD',
      deliveryDays: 14, urgent: false, stackPref: ['Python', 'LangChain', 'React'], tags: ['AI Agent', 'RAG'],
    },
    {
      title: '实时物流数据 Dashboard（Vue + D3）',
      description: '为物流 SaaS 构建高性能实时数据看板：\n\n- WebSocket 实时刷新车辆轨迹与订单状态\n- D3 自定义图表 + 大数据量虚拟滚动\n- 深色主题，需适配大屏投放',
      category: 'DASHBOARD', budgetMin: 1200, budgetMax: 2000, currency: 'USD',
      deliveryDays: 7, urgent: false, stackPref: ['Vue.js', 'D3.js', 'Tailwind'], tags: ['Dashboard', '实时数据'],
    },
    {
      title: '新品发布高转化营销落地页（WebGL 动效）',
      description: '我们下周发布新品，需要一个炫酷的营销落地页：\n\n- WebGL / Three.js 首屏动效\n- Framer Motion 滚动叙事\n- Lighthouse 性能 90+，SEO 友好',
      category: 'LANDING', budgetMin: 800, budgetMax: 1500, currency: 'USD',
      deliveryDays: 3, urgent: true, stackPref: ['Next.js', 'Three.js', 'Framer Motion'], tags: ['落地页', '动效'],
    },
    {
      title: 'Headless Shopify 独立站改造',
      description: '现有标准 Shopify 主题迁移到 Headless 架构：\n\n- Remix + Shopify Storefront API\n- 保留现有 SEO 权重与 301 迁移\n- 结算流程保持 Shopify Checkout',
      category: 'ECOMMERCE', budgetMin: 5000, budgetMax: 8000, currency: 'USD',
      deliveryDays: 14, urgent: false, stackPref: ['Remix', 'GraphQL', 'Shopify API'], tags: ['电商', 'Headless'],
    },
    {
      title: '企业官网重构（中英双语 + CMS）',
      description: '制造业企业官网重构：\n\n- 中英双语，内容走 Headless CMS\n- 产品库 + 询盘表单 + 邮件通知\n- 需要提供后台使用培训文档',
      category: 'CORPORATE', budgetMin: 15000, budgetMax: 25000, currency: 'CNY',
      deliveryDays: 14, urgent: false, stackPref: ['Next.js', 'Strapi', 'Tailwind'], tags: ['官网', 'CMS'],
    },
    {
      title: 'Lovable 半成品 SaaS 救援上线',
      description: '用 Lovable 生成的项目卡在最后一公里：\n\n- 支付（Stripe）与邮件流程未打通\n- 移动端样式错乱需要修复\n- 希望一周内可以正式上线',
      category: 'RESCUE', budgetMin: 3000, budgetMax: 6000, currency: 'CNY',
      deliveryDays: 7, urgent: true, stackPref: ['React', 'Supabase', 'Stripe'], tags: ['救援', 'SaaS'],
    },
  ];

  const created = [];
  for (const p of openProjects) {
    created.push(await prisma.project.create({
      data: {
        ...p,
        clientId: client.id,
        status: 'OPEN',
        publishedAt: new Date(now - Math.floor(Math.random() * 5) * day),
      },
    }));
  }
  console.log(`✅ ${created.length} open demo projects created.`);

  // ---- Builder bids on two open projects (视角：接收者「我的投标」) ----
  const bids = [
    { project: created[0], bidAmount: 3200, estimatedDays: 12, pitch: '做过三个同类 AI 客服 Agent，可先出对接 Shopify 的 PoC 再全量开发。' },
    { project: created[2], bidAmount: 1200, estimatedDays: 3, pitch: '擅长 Three.js 首屏动效，48 小时内可交付第一版预览。' },
  ];
  for (const b of bids) {
    await prisma.application.create({
      data: {
        projectId: b.project.id,
        builderId: builder.id,
        bidAmount: b.bidAmount,
        currency: b.project.currency,
        estimatedDays: b.estimatedDays,
        pitch: b.pitch,
      },
    });
    await prisma.project.update({
      where: { id: b.project.id },
      data: { applicationCount: { increment: 1 } },
    });
  }
  console.log('✅ 2 demo bids created.');

  // ---- One in-progress project (hired) ----
  const inProgress = await prisma.project.create({
    data: {
      clientId: client.id,
      title: 'AI 内容生成后台（进行中示例）',
      description: '内部营销团队用的 AI 文案生成后台：\n\n- OpenAI API 批量生成 + 模板管理\n- 团队协作与审批流\n- 用量统计看板',
      category: 'AI_SAAS', budgetMin: 2000, budgetMax: 2000, currency: 'USD',
      deliveryDays: 7, urgent: false, stackPref: ['React', 'Node.js', 'OpenAI API'], tags: ['AI', '后台'],
      status: 'IN_PROGRESS',
      publishedAt: new Date(now - 10 * day),
      hiredBuilderId: builder.id,
      hiredAt: new Date(now - 3 * day),
      dueAt: new Date(now + 4 * day),
      applicationCount: 1,
    },
  });
  const acceptedApp = await prisma.application.create({
    data: {
      projectId: inProgress.id,
      builderId: builder.id,
      bidAmount: 2000, currency: 'USD', estimatedDays: 7,
      pitch: '带团队做过同类 AI 内容平台，可复用成熟组件库加速交付。',
      status: 'ACCEPTED', respondedAt: new Date(now - 3 * day),
    },
  });
  await prisma.project.update({ where: { id: inProgress.id }, data: { hiredApplicationId: acceptedApp.id } });

  // ---- One completed project with a published review + portfolio entry ----
  const completed = await prisma.project.create({
    data: {
      clientId: client.id,
      title: '健身 App AI 数据看板（已完成示例）',
      description: '为健身 App 构建 AI 分析看板，基于心率变异性预测疲劳度并动态调整训练计划。',
      category: 'DASHBOARD', budgetMin: 3200, budgetMax: 3200, currency: 'USD',
      deliveryDays: 7, urgent: false, stackPref: ['Next.js', 'Python', 'TensorFlow'], tags: ['AI', 'Dashboard'],
      status: 'COMPLETED',
      publishedAt: new Date(now - 30 * day),
      hiredBuilderId: builder.id,
      hiredAt: new Date(now - 25 * day),
      deliveredAt: new Date(now - 20 * day),
      completedAt: new Date(now - 19 * day),
      deliveryNote: '已上线：https://demo.example.com（含管理后台与部署文档）',
      applicationCount: 1,
    },
  });
  const completedApp = await prisma.application.create({
    data: {
      projectId: completed.id,
      builderId: builder.id,
      bidAmount: 3200, currency: 'USD', estimatedDays: 7,
      pitch: '有 TensorFlow.js + 健康数据可视化经验，可一周交付。',
      status: 'ACCEPTED', respondedAt: new Date(now - 25 * day),
    },
  });
  await prisma.project.update({ where: { id: completed.id }, data: { hiredApplicationId: completedApp.id } });
  await prisma.review.create({
    data: {
      projectId: completed.id,
      authorId: client.id,
      targetId: builder.id,
      direction: 'CLIENT_TO_BUILDER',
      rating: 5, communication: 5, speed: 5, codeQuality: 5, aiSkill: 5, delivery: 5,
      comment: '交付质量远超预期：对 OpenAI API 理解很深，前端干净直观，强烈推荐。',
      publishedAt: new Date(now - 18 * day),
    },
  });
  await prisma.portfolioItem.create({
    data: {
      builderId: builderProfile.id,
      title: 'AI 健身数据看板',
      summary: '基于心率变异性的疲劳度预测与训练计划推荐，Next.js + TensorFlow 全栈交付。',
      projectId: completed.id,
      demoUrl: 'https://demo.example.com',
    },
  });
  console.log('✅ In-progress + completed demo projects, review and portfolio created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
