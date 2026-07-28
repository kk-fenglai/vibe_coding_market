import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cancelProject, listMyProjects, submitProject } from '../../api/projects';
import type { Project } from '../../types';

const { Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PENDING_REVIEW: 'gold',
  REJECTED: 'red',
  OPEN: 'green',
  IN_PROGRESS: 'blue',
  REVIEW: 'purple',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

export default function MyProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await listMyProjects();
      setItems(rows);
    } catch {
      message.error(t('market.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    }
  };

  const columns: ColumnsType<Project> = [
    {
      title: t('market.form.title'),
      dataIndex: 'title',
      render: (title: string, p) => <Link to={`/projects/${p.id}`}>{title}</Link>,
    },
    {
      title: t('market.category'),
      dataIndex: 'category',
      responsive: ['md'],
      render: (c: string) => t(`market.cat.${c}`),
    },
    {
      title: t('market.detail.budget'),
      dataIndex: 'budgetMax',
      responsive: ['md'],
      render: (_: unknown, p) => {
        const c = p.currency === 'CNY' ? '¥' : p.currency === 'USD' ? '$' : '€';
        const min = p.budgetMin;
        const max = p.budgetMax;
        return min != null && max != null && min !== max
          ? `${c}${min.toLocaleString()} – ${c}${max.toLocaleString()}`
          : `${c}${(max ?? min ?? 0).toLocaleString()}`;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{t(`market.status.${s}`)}</Tag>,
    },
    {
      title: t('market.applicantsCol'),
      dataIndex: 'applicationCount',
      responsive: ['lg'],
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, p) => {
        const editable = p.status === 'DRAFT' || p.status === 'REJECTED';
        const cancellable = ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'OPEN'].includes(p.status);
        return (
          <Space>
            {editable && (
              <>
                <Button size="small" onClick={() => navigate(`/projects/${p.id}/edit`)}>
                  {t('market.mine.edit')}
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => act(() => submitProject(p.id), t('market.mine.submitOk'))}
                >
                  {t('market.mine.submitReview')}
                </Button>
              </>
            )}
            {cancellable && (
              <Popconfirm
                title={t('market.mine.cancelConfirm')}
                onConfirm={() => act(() => cancelProject(p.id), t('market.mine.cancelled'))}
              >
                <Button size="small" danger>{t('market.mine.cancel')}</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Title level={2} style={{ marginBottom: 0 }}>{t('market.mine.title')}</Title>
        <Button type="primary" onClick={() => navigate('/projects/new')}>{t('market.mine.create')}</Button>
      </div>

      <Card>
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description={t('market.mine.empty')}>
              <Button type="primary" onClick={() => navigate('/projects/new')}>{t('market.mine.create')}</Button>
            </Empty>
          ) : (
            <Table rowKey="id" dataSource={items} columns={columns} pagination={{ pageSize: 20 }} />
          )}
        </Spin>
      </Card>
    </div>
  );
}
