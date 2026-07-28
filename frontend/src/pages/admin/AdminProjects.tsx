import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tag,
  Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/adminClient';
import { PROJECT_STATUSES, type Project } from '../../types';

const { Title, Paragraph } = Typography;

interface AdminProject extends Project {
  client?: { id: string; email?: string; name?: string | null; createdAt?: string };
}

export default function AdminProjects() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [items, setItems] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AdminProject | null>(null);
  const [rejecting, setRejecting] = useState<AdminProject | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/projects', { params: { status, page, pageSize: 20 } });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      message.error(t('market.loadError'));
    } finally {
      setLoading(false);
    }
  }, [status, page, t]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    try {
      const { data } = await adminApi.get(`/projects/${id}`);
      setDetail(data);
    } catch {
      message.error(t('market.loadError'));
    }
  };

  const approve = async (p: AdminProject) => {
    try {
      await adminApi.post(`/projects/${p.id}/approve`);
      message.success(t('adminMarket.approved'));
      setDetail(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    }
  };

  const doReject = async () => {
    if (!rejecting) return;
    if (!rejectNote.trim()) { message.error(t('adminMarket.rejectRequired')); return; }
    try {
      await adminApi.post(`/projects/${rejecting.id}/reject`, { note: rejectNote.trim() });
      message.success(t('adminMarket.rejected'));
      setRejecting(null);
      setRejectNote('');
      setDetail(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    }
  };

  const columns: ColumnsType<AdminProject> = [
    {
      title: t('market.form.title'),
      dataIndex: 'title',
      render: (title: string, p) => <a onClick={() => openDetail(p.id)}>{title}</a>,
    },
    { title: t('adminMarket.client'), dataIndex: ['client', 'email'], responsive: ['md'] },
    {
      title: t('market.category'),
      dataIndex: 'category',
      responsive: ['lg'],
      render: (c: string) => t(`market.cat.${c}`),
    },
    {
      title: t('market.detail.budget'),
      key: 'budget',
      responsive: ['lg'],
      render: (_: unknown, p) => `${p.currency} ${p.budgetMin ?? ''}${p.budgetMax && p.budgetMax !== p.budgetMin ? `–${p.budgetMax}` : ''}`,
    },
    {
      title: t('adminMarket.submittedAt'),
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, p) => (
        <Space>
          <Button size="small" onClick={() => openDetail(p.id)}>{t('adminMarket.detail')}</Button>
          {p.status === 'PENDING_REVIEW' && (
            <>
              <Button size="small" type="primary" onClick={() => approve(p)}>{t('adminMarket.approve')}</Button>
              <Button size="small" danger onClick={() => setRejecting(p)}>{t('adminMarket.reject')}</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Title level={3} style={{ marginBottom: 0 }}>{t('adminMarket.title')}</Title>
        <Select
          value={status}
          style={{ width: 180 }}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={PROJECT_STATUSES.map((s) => ({ value: s, label: t(`market.status.${s}`) }))}
        />
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          locale={{ emptyText: t('adminMarket.empty') }}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showSizeChanger: false }}
        />
      </Card>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        width={720}
        title={detail?.title}
        extra={detail?.status === 'PENDING_REVIEW' && (
          <Space>
            <Button type="primary" onClick={() => detail && approve(detail)}>{t('adminMarket.approve')}</Button>
            <Button danger onClick={() => setRejecting(detail)}>{t('adminMarket.reject')}</Button>
          </Space>
        )}
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small" className="mb-4">
              <Descriptions.Item label="Status">
                <Tag>{t(`market.status.${detail.status}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('adminMarket.client')}>
                {detail.client?.email} {detail.client?.name ? `(${detail.client.name})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label={t('market.category')}>{t(`market.cat.${detail.category}`)}</Descriptions.Item>
              <Descriptions.Item label={t('market.detail.budget')}>
                {detail.currency} {detail.budgetMin} – {detail.budgetMax}
              </Descriptions.Item>
              <Descriptions.Item label={t('market.detail.delivery')}>
                {t('market.days', { count: detail.deliveryDays })}
              </Descriptions.Item>
              {detail.reviewNote && (
                <Descriptions.Item label={t('market.detail.reviewNote')}>{detail.reviewNote}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5}>{t('market.detail.description')}</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</Paragraph>

            {!!detail.attachments?.length && (
              <>
                <Title level={5}>{t('market.detail.attachments')}</Title>
                <Space direction="vertical">
                  {detail.attachments.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer">{a.name} ↗</a>
                  ))}
                </Space>
              </>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={!!rejecting}
        title={t('adminMarket.reject')}
        onCancel={() => { setRejecting(null); setRejectNote(''); }}
        onOk={doReject}
        okButtonProps={{ danger: true }}
      >
        <Paragraph>{t('adminMarket.rejectReason')}</Paragraph>
        <Input.TextArea
          rows={4}
          maxLength={500}
          showCount
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
