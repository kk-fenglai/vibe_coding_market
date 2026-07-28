// 状态变更通知（PRD 6.7：状态变更触发站内信 + 邮件）。
// V1 只做邮件；站内信在 Phase 4（会话/消息）落地后接入。
//
// 所有函数 fire-and-forget：通知失败绝不能让业务操作回滚，只写日志。
const { sendMail, emailShell } = require('./mailer');
const { logger } = require('../utils/logger');

const FRONTEND_URL = process.env.FRONTEND_URL || '';

function projectUrl(projectId) {
  return `${FRONTEND_URL}/projects/${projectId}`;
}

// 任务审核结果（PRD 6.1 审核队列）
function renderProjectReviewEmail({ name, title, approved, note, url }) {
  const greet = name ? `<b>${name}</b>，` : '';
  const heading = approved ? 'BuilderHub · 任务已上架' : 'BuilderHub · 任务未通过审核';
  const body = approved
    ? `<p>${greet}你的任务 <b>${title}</b> 已通过审核并上架任务市场，开发者现在可以申请接单。</p>`
    : `<p>${greet}你的任务 <b>${title}</b> 未通过审核。</p>
       ${note ? `<p style="padding:12px;background:#fef2f2;border-radius:8px">原因：${note}</p>` : ''}
       <p>修改后可重新提交审核。</p>`;
  return {
    subject: approved ? '[BuilderHub] 任务已上架' : '[BuilderHub] 任务未通过审核',
    html: emailShell({
      heading,
      bodyHtml: `${body}<p><a href="${url}" style="color:#1e40af">查看任务 →</a></p>`,
    }),
  };
}

async function notifyProjectReviewed({ email, name, project, approved, note }) {
  if (!email) return;
  try {
    const { subject, html } = renderProjectReviewEmail({
      name,
      title: project.title,
      approved,
      note,
      url: projectUrl(project.id),
    });
    await sendMail({ to: email, subject, html });
  } catch (e) {
    logger.warn({ err: e, projectId: project?.id }, 'notifyProjectReviewed failed');
  }
}

module.exports = { notifyProjectReviewed, renderProjectReviewEmail, projectUrl };
