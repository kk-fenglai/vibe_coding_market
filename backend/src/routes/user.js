const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const passwordPolicy = require('../utils/passwordPolicy');
const { revokeAllForUser } = require('../services/refreshTokens');
const { effectivePlan } = require('../middleware/requirePlan');

const router = express.Router();

// GET /api/user/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionEnd: true,
        createdAt: true,
      },
    });
    res.json({
      user: {
        ...user,
        effectivePlan: req.userPlan || effectivePlan(user),
      },
    });
  } catch (e) { next(e); }
});

// POST /api/user/change-password  { oldPassword, newPassword }
const changePwdSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(10)
    .max(100)
    .refine((p) => passwordPolicy.validate(p).ok, (p) => ({
      message: passwordPolicy.validate(p).reasons.join('; ') || 'Weak password',
    })),
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = changePwdSchema.parse(req.body);

    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        role: true,
      },
    });
    if (!me || me.status !== 'ACTIVE' || me.deletedAt) {
      return res.status(403).json({ error: 'Account unavailable' });
    }
    if (me.role === 'ADMIN' || me.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin accounts must change password in the admin console' });
    }

    const ok = await bcrypt.compare(oldPassword, me.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Incorrect current password' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: hash, failedLoginCount: 0, lockedUntil: null },
    });

    try { await revokeAllForUser(me.id, { reason: 'PASSWORD_CHANGE' }); } catch { /* ignore */ }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
