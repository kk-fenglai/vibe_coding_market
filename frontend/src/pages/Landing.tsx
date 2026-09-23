import { Button } from 'antd';
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

const VALUES = [
  { icon: <ThunderboltOutlined />, key: 'fast', tint: 'bg-[#eff6ff] text-[#3b82f6]' },
  { icon: <DollarOutlined />, key: 'cheap', tint: 'bg-[#ecfdf5] text-[#10b981]' },
  { icon: <SafetyCertificateOutlined />, key: 'verified', tint: 'bg-[#faf5ff] text-[#a855f7]' },
  { icon: <LockOutlined />, key: 'escrow', tint: 'bg-[#f0fdfa] text-[#14b8a6]' },
];

const STATS = ['speed', 'cost', 'escrow'];
const STEPS = ['s1', 's2', 's3', 's4'];

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="max-w-[1216px] mx-auto">
      {/* ── Hero ── */}
      <section
        className="rounded-3xl overflow-hidden px-6 py-16 md:px-20 md:py-20 mb-6 text-center shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]"
        style={{ background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 100%)' }}
      >
        <span className="inline-block px-[17px] py-[5px] mb-6 rounded-full text-base text-white bg-white/10 backdrop-blur-sm">
          {t('landing.badge')}
        </span>
        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-[-0.96px] md:leading-[60px] mb-6 max-w-3xl mx-auto">
          {t('landing.title')}
        </h1>
        <p className="text-base md:text-lg text-[#cbd5e1] mb-12 max-w-2xl mx-auto leading-7">
          {t('landing.subtitle')}
        </p>
        <div className="flex gap-3 justify-center flex-wrap mb-20">
          <Link to="/projects/new">
            <Button type="primary" className="h-[54px] px-[25px] text-lg rounded-full">
              {t('landing.ctaPost')}
            </Button>
          </Link>
          <Link to="/projects">
            <Button
              ghost
              className="h-[54px] px-[25px] text-lg rounded-full backdrop-blur-sm"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              {t('landing.ctaBrowse')}
            </Button>
          </Link>
        </div>

        {/* stats */}
        <div className="flex justify-center gap-10 md:gap-20 flex-wrap max-w-3xl mx-auto pt-6">
          {STATS.map((s) => (
            <div key={s}>
              <div className="text-3xl md:text-5xl font-bold text-white tracking-[-0.96px]">
                {t(`landing.stats.${s}.value`)}
              </div>
              <div className="text-base text-[#94a3b8] mt-1">{t(`landing.stats.${s}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Value props ── */}
      <section className="pt-20">
        <h2 className="text-center text-[32px] font-bold text-hub-heading mb-12">
          {t('landing.valueTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUES.map((v) => (
            <div
              key={v.key}
              className="bg-white rounded-2xl shadow-soft p-[25px]"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${v.tint}`}>
                {v.icon}
              </div>
              <h3 className="text-2xl font-semibold text-hub-heading tracking-[-0.24px] mt-5 mb-1">
                {t(`landing.value.${v.key}.title`)}
              </h3>
              <p className="text-base text-hub-body leading-6 mb-0">{t(`landing.value.${v.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="pt-20">
        <h2 className="text-center text-[32px] font-bold text-hub-heading mb-12">
          {t('landing.howTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="bg-white rounded-2xl shadow-soft p-[25px]"
            >
              <div className="text-[40px] leading-[60px] font-bold text-[#3b82f6]">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="text-xl font-bold text-hub-heading mb-1">{t(`landing.how.${s}.title`)}</h3>
              <p className="text-sm text-hub-body leading-5 mb-0">{t(`landing.how.${s}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="pt-20">
        <h2 className="text-center text-[32px] font-bold text-hub-heading mb-6">
          {t('landing.categoriesTitle')}
        </h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {PROJECT_CATEGORIES.map((c) => (
            <Link
              key={c}
              to={`/projects?category=${c}`}
              className="px-4 py-2 rounded-full text-sm font-medium !text-hub-heading !bg-[#f1f0ed] hover:!bg-[#e9e7e2] transition-colors"
            >
              {t(`market.cat.${c}`)}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Dual CTA ── */}
      <section className="py-20 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="rounded-3xl min-h-[300px] p-10 lg:p-20 flex flex-col justify-between text-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
        >
          <RocketOutlined className="text-4xl mb-6 self-start" />
          <div className="pb-12">
            <h3 className="text-[28px] leading-[42px] font-bold text-white mb-3">{t('landing.clientTitle')}</h3>
            <p className="text-base leading-6 mb-0" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {t('landing.clientDesc')}
            </p>
          </div>
          <Link to="/projects/new" className="self-start">
            <button className="bg-white text-[#2563eb] font-bold text-base px-6 py-3 rounded-full border-0 cursor-pointer">
              {t('landing.clientCta')}
            </button>
          </Link>
        </div>
        <div
          className="rounded-3xl min-h-[300px] p-10 lg:p-20 flex flex-col justify-between text-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          style={{ background: 'linear-gradient(135deg, #111827 0%, #0f172a 100%)' }}
        >
          <CodeOutlined className="text-4xl mb-6 self-start" />
          <div className="pb-12">
            <h3 className="text-[28px] leading-[42px] font-bold text-white mb-3">{t('landing.builderTitle')}</h3>
            <p className="text-base leading-6 text-[#cbd5e1] mb-0">{t('landing.builderDesc')}</p>
          </div>
          <Link to="/register" className="self-start">
            <button className="bg-transparent text-white font-bold text-base px-[25px] py-[13px] rounded-full border border-solid border-white/30 cursor-pointer backdrop-blur-sm shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
              {t('landing.builderCta')}
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
