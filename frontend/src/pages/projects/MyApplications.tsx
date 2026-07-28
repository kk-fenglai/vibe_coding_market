import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listMyApplications, withdrawApplication } from '../../api/applications';
import type { Application } from '../../types';

const { Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'gold',
  ACCEPTED: 'green',
  REJECTED: 'red',
  WITHDRAWN: 'default',
};

export default function MyApplications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await listMyApplications();
      setItems(rows);
    } catch {
      message.error(t('market.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const withdraw = async (id: string) => {
    try {
      await withdrawApplication(id);
      message.success(t('market.myApps.withdrawOk'));
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    }
  };

  const columns: ColumnsType<Application> = [
    {
      title: t('market.myApps.project'),
      dataIndex: ['project', 'title'],
      render: (title: string, a) => <Link to={`/projects/${a.projectId}`}>{title}</Link>,
    },
    {
      title: t('market.category'),
      dataIndex: ['project', 'category'],
      responsive: ['md'],
      render: (c: string) => (c ? t(`market.cat.${c}`) : '—'),
    },
    {
      title: t('market.apps.bid'),
      dataIndex: 'bidAmount',
      render: (v: number, a) => {
        const c = a.currency === 'CNY' ? '¥' : a.currency === 'USD' ? '$' : '€';
        return `${c}${v.toLocaleString()}`;
      },
    },
    {
      title: t('market.detail.estimatedDays'),
      dataIndex: 'estimatedDays',
      responsive: ['md'],
      render: (d: number) => t('market.apps.days', { count: d }),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string, a) => (
        <Space>
          <Tag color={STATUS_COLOR[s]}>{t(`market.apps.status.${s}`)}</Tag>
          {a.project && <Tag>{t(`market.status.${a.project.status}`)}</Tag>}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, a) => a.status === 'PENDING' && (
        <Popconfirm title={t('market.myApps.withdrawAsk')} onConfirm={() => withdraw(a.id)}>
          <Button size="small" danger>{t('market.myApps.withdraw')}</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Title level={2} style={{ marginBottom: 0 }}>{t('market.myApps.title')}</Title>
        <Button type="primary" onClick={() => navigate('/projects')}>{t('market.myApps.browse')}</Button>
      </div>

      <Card>
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description={t('market.myApps.empty')}>
              <Button type="primary" onClick={() => navigate('/projects')}>{t('market.myApps.browse')}</Button>
            </Empty>
          ) : (
            <Table rowKey="id" dataSource={items} columns={columns} pagination={{ pageSize: 20 }} />
          )}
        </Spin>
      </Card>
    </div>
  );
}
