import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Input, Modal, Segmented, Space, Table, Tag, Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../api/adminClient';

const { Title, Paragraph } = Typography;

interface AdminBuilderRow {
  id: string;
  userId: string;
  headline?: string | null;
  bio?: string | null;
  skills: string[];
  aiTools: string[];
  githubUrl?: string | null;
  websiteUrl?: string | null;
  verified: boolean;
  verifiedAt?: string | null;
  verifyNote?: string | null;
  completedCount: number;
  ratingSum: number;
  ratingCount: number;
  createdAt: string;
  user: { id: string; email: string; name?: string | null; createdAt: string };
  portfolio: { id: string; title: string; demoUrl?: string | null; repoUrl?: string | null }[];
}

export default function AdminBuilders() {
  const [items, setItems] = useState<AdminBuilderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [noteModal, setNoteModal] = useState<{ row: AdminBuilderRow; verified: boolean } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (filter !== 'all') params.verified = filter;
      if (q) params.q = q;
      const { data } = await adminApi.get('/builders', { params });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, filter, q]);

  useEffect(() => { load(); }, [load]);

  const doVerify = async () => {
    if (!noteModal) return;
    try {
      await adminApi.post(`/builders/${noteModal.row.userId}/verify`, {
        verified: noteModal.verified,
        note: note || undefined,
      });
      message.success(noteModal.verified ? '已通过认证' : '已撤销认证');
      setNoteModal(null);
      setNote('');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const columns: ColumnsType<AdminBuilderRow> = [
    {
      title: 'Builder',
      dataIndex: ['user', 'email'],
      render: (_: string, r) => (
        <>
          <div>{r.user.name || '—'}</div>
          <div className="text-xs text-gray-500">{r.user.email}</div>
        </>
      ),
    },
    {
      title: '介绍 / 技能',
      dataIndex: 'headline',
      responsive: ['md'],
      render: (_: string, r) => (
        <>
          {r.headline && <div className="mb-1">{r.headline}</div>}
          <Space wrap size={[4, 4]}>
            {r.aiTools.map((tool) => <Tag key={tool} color="blue">{tool}</Tag>)}
            {r.skills.slice(0, 5).map((s) => <Tag key={s}>{s}</Tag>)}
          </Space>
        </>
      ),
    },
    {
      title: '作品/链接',
      key: 'links',
      responsive: ['lg'],
      render: (_: unknown, r) => (
        <Space direction="vertical" size={0}>
          {r.githubUrl && <a href={r.githubUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
          {r.websiteUrl && <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer">网站 ↗</a>}
          <span className="text-xs text-gray-500">作品 {r.portfolio.length} · 完成 {r.completedCount}</span>
        </Space>
      ),
    },
    {
      title: '认证状态',
      dataIndex: 'verified',
      render: (v: boolean, r) => (
        <>
          <Tag color={v ? 'gold' : 'default'}>{v ? 'Verified' : '未认证'}</Tag>
          {r.verifyNote && <div className="text-xs text-gray-500">{r.verifyNote}</div>}
        </>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r) => (
        <Space>
          {r.verified ? (
            <Button size="small" danger onClick={() => { setNoteModal({ row: r, verified: false }); setNote(''); }}>
              撤销认证
            </Button>
          ) : (
            <Button size="small" type="primary" onClick={() => { setNoteModal({ row: r, verified: true }); setNote(''); }}>
              通过认证
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Builder 认证审核</Title>
      <Card>
        <Space className="mb-4" wrap>
          <Segmented
            value={filter}
            onChange={(v) => { setFilter(v as string); setPage(1); }}
            options={[
              { label: '全部', value: 'all' },
              { label: '未认证', value: 'false' },
              { label: '已认证', value: 'true' },
            ]}
          />
          <Input.Search
            placeholder="搜索邮箱 / 姓名 / 介绍"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => { setQ(v); setPage(1); }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ current: page, pageSize: 20, total, onChange: setPage }}
          expandable={{
            expandedRowRender: (r) => (
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{r.bio || '（无详细介绍）'}</Paragraph>
            ),
          }}
        />
      </Card>

      <Modal
        open={!!noteModal}
        title={noteModal?.verified ? '通过 Verified Builder 认证' : '撤销认证'}
        onCancel={() => setNoteModal(null)}
        onOk={doVerify}
        okText="确认"
        okButtonProps={{ danger: !noteModal?.verified }}
      >
        <Input.TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="审核备注 / 驳回原因（选填，对内记录）"
          maxLength={1000}
        />
      </Modal>
    </div>
  );
}
