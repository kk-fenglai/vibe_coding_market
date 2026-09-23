import { useEffect, useState } from 'react';
import { Avatar, Empty, Rate, Result, Spin, Tag } from 'antd';
import { UserOutlined, GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicBuilder } from '../api/builders';
import type { PublicBuilderProfile, Review } from '../types';

const AI_TOOL_LABELS: Record<string, string> = {
  CURSOR: 'Cursor',
  CLAUDE_CODE: 'Claude Code',
  LOVABLE: 'Lovable',
  BOLT: 'Bolt',
  V0: 'v0',
  WINDSURF: 'Windsurf',
  REPLIT_AGENT: 'Replit Agent',
};

// 公开 Builder 主页：资料 + 信誉 + 作品集 + 已发布的客户评价
export default function BuilderPublicProfile() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PublicBuilderProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPublicBuilder(id)
      .then(({ profile: p, reviews: r }) => { if (alive) { setProfile(p); setReviews(r); } })
      .catch(() => { if (alive) setProfile(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!profile) return <Result status="404" title={t('builderPublic.notFound')} />;

  const avg = profile.ratingCount > 0 ? profile.ratingSum / profile.ratingCount : null;

  const statCard = 'bg-white rounded-2xl shadow-soft p-[25px]';
  const statLabel = 'text-sm font-semibold uppercase tracking-[0.7px] text-hub-body';
  const sectionTitle = 'text-2xl font-semibold text-hub-heading tracking-[-0.24px] m-0 pb-[5px]';

  return (
    <div className="max-w-[1216px] mx-auto flex flex-col gap-12">
      {/* ── Hero & stats bento ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 relative overflow-hidden bg-white rounded-3xl shadow-soft p-8 lg:p-12 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ background: 'rgba(160,65,0,0.05)', filter: 'blur(32px)', width: 256, height: 256, right: -64, top: -128 }}
          />
          <Avatar
            size={128}
            src={profile.avatarUrl || undefined}
            icon={<UserOutlined />}
            className="shrink-0 border-4 border-solid border-white shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-5xl font-bold text-hub-heading tracking-[-0.96px] m-0">
                {profile.name || '—'}
              </h1>
              {profile.verified && (
                <span className="bg-[rgba(255,107,0,0.1)] text-hub-primary text-sm font-semibold px-3 py-1 rounded-full">
                  ★ {t('market.apps.verified')}
                </span>
              )}
            </div>
            {profile.headline && (
              <div className="text-2xl font-semibold text-hub-body tracking-[-0.24px] mt-1">{profile.headline}</div>
            )}
            {profile.bio && (
              <p className="text-base text-[#5d5f5f] leading-6 mt-2 mb-0 max-w-2xl whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>
          <div className="flex md:flex-col gap-3 shrink-0">
            {profile.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#f1f0ed] text-hub-heading text-sm font-semibold px-6 py-3 rounded-full flex items-center gap-1 justify-center"
              >
                <GithubOutlined /> GitHub
              </a>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#f1f0ed] text-hub-heading text-sm font-semibold px-6 py-3 rounded-full flex items-center gap-1 justify-center"
              >
                <GlobalOutlined /> {t('builder.websiteUrl')}
              </a>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
          <div className={statCard}>
            <div className={statLabel}>{t('builderPublic.rating')}</div>
            <div className="text-5xl font-bold text-hub-primary tracking-[-0.96px] leading-[56px]">
              {avg != null ? avg.toFixed(1) : '—'}
              {avg != null && <span className="text-2xl text-hub-body font-semibold"> / 5 ({profile.ratingCount})</span>}
            </div>
          </div>
          <div className={statCard}>
            <div className={statLabel}>{t('builderPublic.completed')}</div>
            <div className="text-5xl font-bold text-hub-heading tracking-[-0.96px] leading-[56px]">
              {profile.completedCount}
            </div>
          </div>
          {profile.totalEarned != null && (
            <div className={statCard}>
              <div className={statLabel}>{t('builderPublic.earned')}</div>
              <div className="text-5xl font-bold text-hub-heading tracking-[-0.96px] leading-[56px]">
                {profile.totalEarned.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Core expertise ── */}
      <section className="flex flex-col gap-6">
        <h2 className={sectionTitle}>{t('builder.skills')}</h2>
        <div className="flex flex-wrap gap-3">
          {profile.aiTools.map((tool) => (
            <span key={tool} className="bg-[rgba(255,107,0,0.1)] text-hub-primary text-sm font-mono px-3 py-1 rounded-full">
              {AI_TOOL_LABELS[tool] || tool}
            </span>
          ))}
          {profile.skills.map((s) => (
            <span key={s} className="bg-[#dce9ff] text-hub-body text-sm font-mono px-3 py-1 rounded-full">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ── Recent work ── */}
      <section className="flex flex-col gap-6">
        <h2 className={sectionTitle}>{t('builderPublic.portfolio')}</h2>
        {profile.portfolio.length === 0 ? (
          <Empty description={t('builderPublic.noPortfolio')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.portfolio.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-soft overflow-hidden">
                <div className="h-48 bg-[#dce9ff] overflow-hidden">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover block" />
                  )}
                </div>
                <div className="p-6 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-hub-heading tracking-[0.14px] m-0">{p.title}</h3>
                    {p.projectId && <Tag color="green" className="m-0">{t('builderPublic.platformDelivery')}</Tag>}
                  </div>
                  {p.summary && <p className="text-sm text-[#5d5f5f] leading-5 m-0 line-clamp-2">{p.summary}</p>}
                  <div className="flex gap-3 flex-wrap mt-1 text-sm">
                    {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noopener noreferrer">Demo ↗</a>}
                    {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">Repo ↗</a>}
                    {p.figmaUrl && <a href={p.figmaUrl} target="_blank" rel="noopener noreferrer">Figma ↗</a>}
                    {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noopener noreferrer">Video ↗</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Latest feedback ── */}
      <section className="flex flex-col gap-6">
        <h2 className={sectionTitle}>{t('builderPublic.reviews')}</h2>
        {reviews.length === 0 ? (
          <Empty description={t('review.none')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-soft p-[25px] flex flex-col gap-3">
                <Rate disabled value={r.rating} style={{ color: '#ff6b00', fontSize: 18 }} />
                {r.comment && (
                  <p className="text-lg italic text-hub-heading leading-7 m-0 whitespace-pre-wrap">
                    “{r.comment}”
                  </p>
                )}
                <div className="flex items-center gap-3 pt-3">
                  <Avatar size={40} icon={<UserOutlined />} className="bg-[#dce9ff]" />
                  <div>
                    <div className="text-sm font-semibold text-hub-heading tracking-[0.14px]">
                      {r.author?.name || '—'}
                    </div>
                    {r.project && (
                      <Link to={`/projects/${r.project.id}`} className="text-xs font-mono text-[#5d5f5f]">
                        {r.project.title}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
