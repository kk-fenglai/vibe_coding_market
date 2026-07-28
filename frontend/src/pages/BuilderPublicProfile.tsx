import { useEffect, useState } from 'react';
import {
  Avatar, Card, Col, Empty, List, Rate, Result, Row, Space, Spin, Statistic, Tag, Typography,
} from 'antd';
import { UserOutlined, GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicBuilder } from '../api/builders';
import type { PublicBuilderProfile, Review } from '../types';

const { Title, Paragraph, Text } = Typography;

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

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="flex gap-4 items-start flex-wrap">
          <Avatar size={72} src={profile.avatarUrl || undefined} icon={<UserOutlined />} />
          <div className="flex-1 min-w-52">
            <Space wrap>
              <Title level={3} style={{ marginBottom: 0 }}>{profile.name || '—'}</Title>
              {profile.verified && <Tag color="gold">{t('market.apps.verified')}</Tag>}
            </Space>
            {profile.headline && <Paragraph className="mt-1 mb-2">{profile.headline}</Paragraph>}
            <Space wrap size={[4, 4]}>
              {profile.aiTools.map((tool) => <Tag key={tool} color="blue">{AI_TOOL_LABELS[tool] || tool}</Tag>)}
              {profile.skills.map((s) => <Tag key={s}>{s}</Tag>)}
            </Space>
            <div className="mt-2">
              <Space size="middle" wrap>
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer">
                    <GithubOutlined /> GitHub
                  </a>
                )}
                {profile.websiteUrl && (
                  <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <GlobalOutlined /> {t('builder.websiteUrl')}
                  </a>
                )}
              </Space>
            </div>
          </div>
        </div>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={8}>
            <Statistic title={t('builderPublic.completed')} value={profile.completedCount} />
          </Col>
          <Col xs={8}>
            <Statistic
              title={t('builderPublic.rating')}
              value={avg != null ? avg.toFixed(1) : '—'}
              suffix={avg != null ? `/ 5 (${profile.ratingCount})` : undefined}
            />
          </Col>
          {profile.totalEarned != null && (
            <Col xs={8}>
              <Statistic title={t('builderPublic.earned')} value={profile.totalEarned} precision={0} />
            </Col>
          )}
        </Row>

        {profile.bio && (
          <>
            <Title level={5} className="mt-4">{t('builder.bio')}</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{profile.bio}</Paragraph>
          </>
        )}
      </Card>

      <Card className="mt-4" title={t('builderPublic.portfolio')}>
        {profile.portfolio.length === 0 ? (
          <Empty description={t('builderPublic.noPortfolio')} />
        ) : (
          <Row gutter={[16, 16]}>
            {profile.portfolio.map((p) => (
              <Col xs={24} md={12} key={p.id}>
                <Card size="small" hoverable>
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full rounded mb-2"
                      style={{ maxHeight: 180, objectFit: 'cover' }}
                    />
                  )}
                  <Space wrap>
                    <Text strong>{p.title}</Text>
                    {p.projectId && <Tag color="green">{t('builderPublic.platformDelivery')}</Tag>}
                  </Space>
                  {p.summary && <Paragraph className="mb-1 mt-1" type="secondary">{p.summary}</Paragraph>}
                  <Space wrap size="small">
                    {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noopener noreferrer">Demo ↗</a>}
                    {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">Repo ↗</a>}
                    {p.figmaUrl && <a href={p.figmaUrl} target="_blank" rel="noopener noreferrer">Figma ↗</a>}
                    {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noopener noreferrer">Video ↗</a>}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Card className="mt-4" title={t('builderPublic.reviews')}>
        {reviews.length === 0 ? (
          <Empty description={t('review.none')} />
        ) : (
          <List
            dataSource={reviews}
            renderItem={(r) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <span>{r.author?.name || '—'}</span>
                      <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
                      {r.project && (
                        <Link to={`/projects/${r.project.id}`} className="text-xs">
                          {r.project.title}
                        </Link>
                      )}
                    </Space>
                  }
                  description={r.comment && <span style={{ whiteSpace: 'pre-wrap' }}>{r.comment}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
