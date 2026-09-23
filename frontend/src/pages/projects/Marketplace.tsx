import { useCallback, useEffect, useState } from 'react';
import {
  Checkbox, Input, Select, InputNumber, Switch, Button, Tag,
  Pagination, Empty, Spin, message,
} from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listProjects, type MarketFilters } from '../../api/projects';
import { PROJECT_CATEGORIES, CURRENCIES, DELIVERY_DAYS, type Project } from '../../types';

const SKILL_CHIPS = ['React', 'Vue.js', 'Next.js', 'Python', 'Tailwind', 'LangChain', 'Three.js', 'Node.js'];

function budgetLabel(p: Project) {
  const c = p.currency === 'CNY' ? '¥' : p.currency === 'USD' ? '$' : '€';
  if (p.budgetMin != null && p.budgetMax != null && p.budgetMin !== p.budgetMax) {
    return `${c}${p.budgetMin.toLocaleString()} – ${c}${p.budgetMax.toLocaleString()}`;
  }
  const one = p.budgetMax ?? p.budgetMin;
  return one == null ? '—' : `${c}${one.toLocaleString()}`;
}

export default function Marketplace() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);

  // URL 即状态：筛选条件放 query string，刷新/分享链接后结果一致。
  const page = Number(params.get('page') || 1);
  const pageSize = 20;
  const filters: MarketFilters = {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    currency: params.get('currency') || undefined,
    budgetMin: params.get('budgetMin') ? Number(params.get('budgetMin')) : undefined,
    budgetMax: params.get('budgetMax') ? Number(params.get('budgetMax')) : undefined,
    maxDeliveryDays: params.get('maxDeliveryDays') ? Number(params.get('maxDeliveryDays')) : undefined,
    urgent: params.get('urgent') === 'true' || undefined,
    stack: params.get('stack') || undefined,
    sort: (params.get('sort') as MarketFilters['sort']) || 'newest',
    page,
    pageSize,
  };

  const setFilter = (key: string, value: string | number | boolean | undefined) => {
    const next = new URLSearchParams(params);
    if (value === undefined || value === '' || value === false) next.delete(key);
    else next.set(key, String(value));
    if (key !== 'page') next.delete('page');   // 改筛选条件回到第一页
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects(filters);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      message.error(t('market.loadError'));
    } finally {
      setLoading(false);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const activeCategory = params.get('category') || undefined;
  const activeStack = params.get('stack') || undefined;

  const filterCard = 'bg-white rounded-2xl shadow-soft p-[25px] w-full';
  const filterTitle = 'text-2xl font-semibold text-hub-heading tracking-[-0.24px] mb-4 mt-0';

  return (
    <div className="max-w-[1216px] mx-auto flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Sidebar filters ── */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
        <div className={filterCard}>
          <h3 className={filterTitle}>{t('market.search')}</h3>
          <Input.Search
            allowClear
            placeholder={t('market.search')}
            defaultValue={params.get('q') || ''}
            onSearch={(v) => setFilter('q', v || undefined)}
          />
        </div>

        <div className={filterCard}>
          <h3 className={filterTitle}>{t('market.category')}</h3>
          <div className="flex flex-col gap-3">
            {PROJECT_CATEGORIES.map((c) => (
              <Checkbox
                key={c}
                checked={activeCategory === c}
                onChange={(e) => setFilter('category', e.target.checked ? c : undefined)}
              >
                <span className="text-base text-hub-body">{t(`market.cat.${c}`)}</span>
              </Checkbox>
            ))}
          </div>
        </div>

        <div className={filterCard}>
          <h3 className={filterTitle}>{t('market.budgetMin')} / {t('market.budgetMax')}</h3>
          <div className="flex items-center gap-2 mb-3">
            <InputNumber
              className="flex-1"
              min={0}
              placeholder={t('market.budgetMin')}
              value={params.get('budgetMin') ? Number(params.get('budgetMin')) : null}
              onChange={(v) => setFilter('budgetMin', v ?? undefined)}
            />
            <span className="text-hub-body">–</span>
            <InputNumber
              className="flex-1"
              min={0}
              placeholder={t('market.budgetMax')}
              value={params.get('budgetMax') ? Number(params.get('budgetMax')) : null}
              onChange={(v) => setFilter('budgetMax', v ?? undefined)}
            />
          </div>
          <Select
            allowClear
            className="w-full"
            placeholder={t('market.currency')}
            value={params.get('currency') || undefined}
            onChange={(v) => setFilter('currency', v)}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>

        <div className={filterCard}>
          <h3 className={filterTitle}>{t('market.stack')}</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {SKILL_CHIPS.map((s) => {
              const active = activeStack === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter('stack', active ? undefined : s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                    active
                      ? 'bg-[rgba(255,107,0,0.1)] text-hub-primary'
                      : 'bg-[#f1f0ed] text-hub-heading hover:bg-[#e9e7e2]'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <Input
            allowClear
            placeholder={t('market.stack')}
            defaultValue={activeStack && !SKILL_CHIPS.includes(activeStack) ? activeStack : ''}
            onBlur={(e) => e.target.value && setFilter('stack', e.target.value)}
            onPressEnter={(e) => setFilter('stack', (e.target as HTMLInputElement).value || undefined)}
          />
        </div>

        <div className={filterCard}>
          <h3 className={filterTitle}>{t('market.maxDelivery')}</h3>
          <Select
            allowClear
            className="w-full mb-3"
            placeholder={t('market.maxDelivery')}
            value={params.get('maxDeliveryDays') || undefined}
            onChange={(v) => setFilter('maxDeliveryDays', v)}
            options={DELIVERY_DAYS.map((d) => ({ value: String(d), label: t('market.days', { count: d }) }))}
          />
          <div className="flex items-center gap-2 mb-4">
            <Switch
              checked={params.get('urgent') === 'true'}
              onChange={(v) => setFilter('urgent', v || undefined)}
            />
            <span className="text-base text-hub-body">{t('market.urgentOnly')}</span>
          </div>
          <Button block onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            {t('market.reset')}
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-base font-normal text-hub-heading m-0">{t('market.title')}</h1>
            <p className="text-lg text-hub-body leading-7 mt-2 mb-0 max-w-2xl">{t('market.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              className="w-40"
              value={params.get('sort') || 'newest'}
              onChange={(v) => setFilter('sort', v)}
              options={[
                { value: 'newest', label: t('market.sortNewest') },
                { value: 'budget', label: t('market.sortBudget') },
                { value: 'delivery', label: t('market.sortDelivery') },
              ]}
            />
            <Link to="/projects/new">
              <Button type="primary" className="font-semibold">{t('nav.postProject')}</Button>
            </Link>
          </div>
        </div>

        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description={t('market.empty')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {items.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block">
                  <article className="bg-white rounded-2xl shadow-soft p-[25px] h-full flex flex-col transition-shadow hover:shadow-lift">
                    <div className="flex items-start justify-between gap-2 pb-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-[#eff4ff] text-hub-body text-xs uppercase tracking-[0.6px] px-2 py-1 rounded-md">
                          {t(`market.cat.${p.category}`)}
                        </span>
                        {p.urgent && (
                          <span className="bg-[rgba(255,107,0,0.1)] text-hub-primary text-xs uppercase tracking-[0.6px] px-2 py-1 rounded-md">
                            {t('market.urgent')}
                          </span>
                        )}
                      </div>
                      {p.hasApplied && <Tag color="green" className="m-0">{t('market.applied')}</Tag>}
                    </div>
                    <h3 className="text-2xl font-semibold text-hub-heading tracking-[-0.24px] leading-8 m-0 pb-2 line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="text-base text-hub-body leading-6 mb-6 line-clamp-3">
                      {p.description || p.tags.join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pb-6 mt-auto">
                      {p.stackPref.slice(0, 3).map((s) => (
                        <span key={s} className="bg-[#121212] text-white text-sm font-mono px-2 py-1 rounded-md">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <div>
                        <div className="text-sm font-semibold text-hub-body tracking-[0.14px]">{t('market.budgetRange')}</div>
                        <div className="text-2xl font-semibold text-hub-heading tracking-[-0.24px]">{budgetLabel(p)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-hub-body tracking-[0.14px]">
                          <ClockCircleOutlined className="mr-1" />
                          {t('market.deliveryIn', { count: p.deliveryDays })}
                        </div>
                        <div className="text-sm font-semibold text-hub-primary tracking-[0.14px] mt-1">
                          {t('market.applicants', { count: p.applicationCount })}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </Spin>

        {total > pageSize && (
          <div className="flex justify-center pt-12">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={(p) => setFilter('page', p)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
