import { useCallback, useEffect, useState } from 'react';
import {
  Card, Col, Row, Input, Select, InputNumber, Switch, Button, Tag, Typography,
  Pagination, Empty, Spin, Space, message,
} from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listProjects, type MarketFilters } from '../../api/projects';
import { PROJECT_CATEGORIES, CURRENCIES, DELIVERY_DAYS, type Project } from '../../types';

const { Title, Paragraph, Text } = Typography;

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <Title level={2} style={{ marginBottom: 4 }}>{t('market.title')}</Title>
        <Paragraph className="text-gray-500">{t('market.subtitle')}</Paragraph>
      </div>

      <Card className="mb-4" size="small">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              allowClear
              placeholder={t('market.search')}
              defaultValue={params.get('q') || ''}
              onSearch={(v) => setFilter('q', v || undefined)}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              allowClear
              className="w-full"
              placeholder={t('market.category')}
              value={params.get('category') || undefined}
              onChange={(v) => setFilter('category', v)}
              options={PROJECT_CATEGORIES.map((c) => ({ value: c, label: t(`market.cat.${c}`) }))}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              allowClear
              className="w-full"
              placeholder={t('market.currency')}
              value={params.get('currency') || undefined}
              onChange={(v) => setFilter('currency', v)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Col>
          <Col xs={12} md={4}>
            <InputNumber
              className="w-full"
              min={0}
              placeholder={t('market.budgetMin')}
              value={params.get('budgetMin') ? Number(params.get('budgetMin')) : null}
              onChange={(v) => setFilter('budgetMin', v ?? undefined)}
            />
          </Col>
          <Col xs={12} md={4}>
            <InputNumber
              className="w-full"
              min={0}
              placeholder={t('market.budgetMax')}
              value={params.get('budgetMax') ? Number(params.get('budgetMax')) : null}
              onChange={(v) => setFilter('budgetMax', v ?? undefined)}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              allowClear
              className="w-full"
              placeholder={t('market.maxDelivery')}
              value={params.get('maxDeliveryDays') || undefined}
              onChange={(v) => setFilter('maxDeliveryDays', v)}
              options={DELIVERY_DAYS.map((d) => ({ value: String(d), label: t('market.days', { count: d }) }))}
            />
          </Col>
          <Col xs={24} md={7}>
            <Input
              allowClear
              placeholder={t('market.stack')}
              defaultValue={params.get('stack') || ''}
              onBlur={(e) => setFilter('stack', e.target.value || undefined)}
              onPressEnter={(e) => setFilter('stack', (e.target as HTMLInputElement).value || undefined)}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              className="w-full"
              value={params.get('sort') || 'newest'}
              onChange={(v) => setFilter('sort', v)}
              options={[
                { value: 'newest', label: t('market.sortNewest') },
                { value: 'budget', label: t('market.sortBudget') },
                { value: 'delivery', label: t('market.sortDelivery') },
              ]}
            />
          </Col>
          <Col xs={12} md={4}>
            <Space>
              <Switch
                checked={params.get('urgent') === 'true'}
                onChange={(v) => setFilter('urgent', v || undefined)}
              />
              <Text>{t('market.urgentOnly')}</Text>
            </Space>
          </Col>
          <Col xs={24} md={3}>
            <Button block onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {t('market.reset')}
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description={t('market.empty')} />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((p) => (
              <Col xs={24} md={12} key={p.id}>
                <Link to={`/projects/${p.id}`}>
                  <Card hoverable className="h-full">
                    <div className="flex justify-between items-start gap-3">
                      <Title level={5} style={{ marginBottom: 4 }}>{p.title}</Title>
                      {p.urgent && <Tag color="red">{t('market.urgent')}</Tag>}
                    </div>
                    <Space wrap size={[4, 4]} className="mb-2">
                      <Tag color="blue">{t(`market.cat.${p.category}`)}</Tag>
                      <Tag>{t('market.deliveryIn', { count: p.deliveryDays })}</Tag>
                      {p.stackPref.slice(0, 3).map((s) => <Tag key={s}>{s}</Tag>)}
                    </Space>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <Text strong style={{ fontSize: 16 }}>{budgetLabel(p)}</Text>
                      <Space size={8}>
                        <Text type="secondary">{t('market.applicants', { count: p.applicationCount })}</Text>
                        {p.hasApplied && <Tag color="green">{t('market.applied')}</Tag>}
                      </Space>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {total > pageSize && (
        <div className="flex justify-center mt-6">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            onChange={(p) => setFilter('page', p)}
          />
        </div>
      )}
    </div>
  );
}
