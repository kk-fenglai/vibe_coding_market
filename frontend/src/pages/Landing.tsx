import { Button, Card, Col, Row, Typography } from 'antd';
import {
  ThunderboltOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  LockOutlined,
  RocketOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PROJECT_CATEGORIES } from '../types';

const { Title, Paragraph } = Typography;

const AI_TOOLS = ['Cursor', 'Claude Code', 'Lovable', 'Bolt', 'v0', 'Windsurf', 'Replit'];

const VALUES = [
  { icon: <ThunderboltOutlined />, key: 'fast', tint: 'bg-blue-50 text-brand' },
  { icon: <DollarOutlined />, key: 'cheap', tint: 'bg-cyan-50 text-cyan-600' },
  { icon: <SafetyCertificateOutlined />, key: 'verified', tint: 'bg-violet-50 text-violet-600' },
  { icon: <LockOutlined />, key: 'escrow', tint: 'bg-emerald-50 text-emerald-600' },
];

const STATS = ['speed', 'cost', 'escrow'];
const STEPS = ['s1', 's2', 's3', 's4'];

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-16 md:px-14 md:py-20 mb-14 text-center"
        style={{ background: '#0b1220' }}
      >
        {/* gradient glows */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(600px 300px at 20% 0%, rgba(37,99,235,0.35), transparent 70%),' +
              'radial-gradient(500px 260px at 85% 15%, rgba(167,139,250,0.25), transparent 70%),' +
              'radial-gradient(700px 300px at 50% 110%, rgba(34,211,238,0.18), transparent 70%)',
          }}
        />
        <div className="relative">
          <span className="inline-block px-4 py-1.5 mb-6 rounded-full text-sm font-medium text-cyan-300 border border-cyan-400/30 bg-cyan-400/10">
            {t('landing.badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-5 max-w-3xl mx-auto">
            {t('landing.title')}
          </h1>
          <p className="text-base md:text-lg text-slate-300 mb-9 max-w-2xl mx-auto">
            {t('landing.subtitle')}
          </p>
          <div className="flex gap-3 justify-center flex-wrap mb-12">
            <Link to="/projects/new">
              <Button type="primary" size="large" className="px-8 h-12 text-base font-medium">
                {t('landing.ctaPost')}
              </Button>
            </Link>
            <Link to="/projects">
              <Button
                size="large"
                ghost
                className="px-8 h-12 text-base font-medium"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              >
                {t('landing.ctaBrowse')}
              </Button>
            </Link>
          </div>

          {/* stats */}
          <div className="flex justify-center gap-10 md:gap-16 flex-wrap mb-10">
            {STATS.map((s) => (
              <div key={s}>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {t(`landing.stats.${s}.value`)}
                </div>
                <div className="text-sm text-slate-400 mt-1">{t(`landing.stats.${s}.label`)}</div>
              </div>
            ))}
          </div>

          {/* tool chips */}
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">
            {t('landing.toolsLabel')}
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {AI_TOOLS.map((tool) => (
              <span
                key={tool}
                className="px-3 py-1 rounded-full text-sm text-slate-300 border border-white/10 bg-white/5"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value props ── */}
      <Title level={3} className="text-center">{t('landing.valueTitle')}</Title>
      <Row gutter={[16, 16]} className="mb-14 mt-6">
        {VALUES.map((v) => (
          <Col xs={24} sm={12} md={6} key={v.key}>
            <Card className="h-full">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3 ${v.tint}`}
              >
                {v.icon}
              </div>
              <Title level={5} style={{ marginBottom: 4 }}>{t(`landing.value.${v.key}.title`)}</Title>
              <Paragraph className="text-gray-500 mb-0">{t(`landing.value.${v.key}.desc`)}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── How it works ── */}
      <Title level={3} className="text-center">{t('landing.howTitle')}</Title>
      <Row gutter={[16, 16]} className="mb-14 mt-6">
        {STEPS.map((s, i) => (
          <Col xs={24} sm={12} md={6} key={s}>
            <Card className="h-full">
              <div
                className="text-3xl font-bold mb-2 bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #2563eb, #22d3ee)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <Title level={5} style={{ marginBottom: 4 }}>{t(`landing.how.${s}.title`)}</Title>
              <Paragraph className="text-gray-500 mb-0">{t(`landing.how.${s}.desc`)}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Categories ── */}
      <Title level={3} className="text-center">{t('landing.categoriesTitle')}</Title>
      <div className="flex flex-wrap gap-2.5 justify-center mb-14 mt-6">
        {PROJECT_CATEGORIES.map((c) => (
          <Link
            key={c}
            to={`/projects?category=${c}`}
            className="px-4 py-2 rounded-full text-sm font-medium text-brand-ink border border-slate-300 bg-white hover:border-brand hover:text-brand transition-colors"
          >
            {t(`market.cat.${c}`)}
          </Link>
        ))}
      </div>

      {/* ── Dual CTA ── */}
      <Row gutter={[16, 16]} className="mb-14">
        <Col xs={24} md={12}>
          <div
            className="h-full rounded-2xl p-8 text-white"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb 55%, #22d3ee)' }}
          >
            <RocketOutlined className="text-3xl mb-4" />
            <Title level={4} style={{ color: '#fff', marginBottom: 8 }}>{t('landing.clientTitle')}</Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)' }} className="mb-6">
              {t('landing.clientDesc')}
            </Paragraph>
            <Link to="/projects/new">
              <Button size="large" style={{ color: '#1d4ed8' }}>{t('landing.clientCta')}</Button>
            </Link>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="h-full rounded-2xl p-8 text-white" style={{ background: '#0b1220' }}>
            <CodeOutlined className="text-3xl mb-4 text-cyan-300" />
            <Title level={4} style={{ color: '#fff', marginBottom: 8 }}>{t('landing.builderTitle')}</Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.7)' }} className="mb-6">
              {t('landing.builderDesc')}
            </Paragraph>
            <Link to="/register">
              <Button size="large" ghost style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
                {t('landing.builderCta')}
              </Button>
            </Link>
          </div>
        </Col>
      </Row>
    </div>
  );
}
