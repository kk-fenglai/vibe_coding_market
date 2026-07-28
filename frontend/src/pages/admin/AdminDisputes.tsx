import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Descriptions, InputNumber, Input, Modal, Radio, Segmented, Space, Table, Tag,
  Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../api/adminClient';

const { Title, Paragraph } = Typography;

interface AdminDisputeRow {
  id: string;
  reason: string;
  status: string;
  resolution?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  resolvedAt?: string | null;
  raisedBy: { id: string; email: string; name?: string | null };
  escrow: {
    id: string;
    amount: number;
    currency: string;
    feeRate: number;
    status: string;
    project: { id: string; title: string; status: string };
    client: { id: string; email: string; name?: string | null };
    builder: { id: string; email: string; name?: string | null };
  };
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'red',
  RESOLVED_RELEASE: 'green',
  RESOLVED_REFUND: 'purple',
  RESOLVED_SPLIT: 'blue',
  WITHDRAWN: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: '待仲裁',
  RESOLVED_RELEASE: '已放款 Builder',
  RESOLVED_REFUND: '已全额退款',
  RESOLVED_SPLIT: '已部分退款',
  WITHDRAWN: '已撤回',
};

export default function AdminDisputes() {
  const [items, setItems] = useState<AdminDisputeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('OPEN');
  const [resolving, setResolving] = useState<AdminDisputeRow | null>(null);
  const [action, setAction] = useState<'RELEASE' | 'REFUND' | 'SPLIT'>('RELEASE');
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/disputes', { params: { status, page, pageSize: 20 } });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const money = (v: number, c: string) => `${c === 'CNY' ? '¥' : c === 'USD' ? '$' : '€'}${v.toLocaleString()}`;

  const submit = async () => {
    if (!resolving) return;
    if (resolution.trim().length < 10) {
      message.warning('裁定说明至少 10 个字（对双方可见）');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.post(`/disputes/${resolving.id}/resolve`, {
        action,
        resolution: resolution.trim(),
        ...(action === 'SPLIT' ? { refundAmount } : {}),
      });
      message.success('裁定已执行');
      setResolving(null);
      setResolution('');
      setRefundAmount(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<AdminDisputeRow> = [
    {
      title: '任务',
      dataIndex: ['escrow', 'project', 'title'],
      render: (v: string) => <span className="font-medium">{v}</span>,
    },
    {
      title: '金额',
      dataIndex: ['escrow', 'amount'],
      render: (v: number, r) => money(v, r.escrow.currency),
    },
    {
      title: '发起方',
      dataIndex: ['raisedBy', 'email'],
      responsive: ['md'],
      render: (v: string, r) => (
        <>
          <div>{r.raisedBy.name || '—'}</div>
          <div className="text-xs text-gray-500">{v}</div>
        </>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: '发起时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r) => r.status === 'OPEN' && (
        <Button type="primary" size="small" onClick={() => { setResolving(r); setAction('RELEASE'); }}>
          仲裁
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>纠纷仲裁</Title>
      <Card>
        <Segmented
          className="mb-4"
          value={status}
          onChange={(v) => { setStatus(v as string); setPage(1); }}
          options={[
            { label: '待仲裁', value: 'OPEN' },
            { label: '已放款', value: 'RESOLVED_RELEASE' },
            { label: '已退款', value: 'RESOLVED_REFUND' },
            { label: '部分退款', value: 'RESOLVED_SPLIT' },
          ]}
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ current: page, pageSize: 20, total, onChange: setPage }}
          expandable={{
            expandedRowRender: (r) => (
              <>
                <Descriptions size="small" column={2} className="mb-2">
                  <Descriptions.Item label="客户">{r.escrow.client.email}</Descriptions.Item>
                  <Descriptions.Item label="Builder">{r.escrow.builder.email}</Descriptions.Item>
                  <Descriptions.Item label="任务状态">{r.escrow.project.status}</Descriptions.Item>
                  <Descriptions.Item label="托管状态">{r.escrow.status}</Descriptions.Item>
                </Descriptions>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}><b>纠纷理由：</b>{r.reason}</Paragraph>
                {r.resolution && (
                  <Paragraph style={{ whiteSpace: 'pre-wrap' }}><b>裁定说明：</b>{r.resolution}</Paragraph>
                )}
              </>
            ),
          }}
        />
      </Card>

      <Modal
        open={!!resolving}
        title={`仲裁：${resolving?.escrow.project.title ?? ''}`}
        onCancel={() => setResolving(null)}
        onOk={submit}
        confirmLoading={submitting}
        okText="执行裁定"
        okButtonProps={{ danger: action === 'REFUND' }}
      >
        {resolving && (
          <>
            <Paragraph>
              托管金额：<b>{money(resolving.escrow.amount, resolving.escrow.currency)}</b>
              （费率 {(resolving.escrow.feeRate * 100).toFixed(0)}%）
            </Paragraph>
            <Radio.Group
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mb-3"
              options={[
                { label: '放款给 Builder（任务完成）', value: 'RELEASE' },
                { label: '全额退款客户（任务取消）', value: 'REFUND' },
                { label: '部分退款（其余放款）', value: 'SPLIT' },
              ]}
            />
            {action === 'SPLIT' && (
              <InputNumber
                className="mb-3"
                style={{ width: '100%' }}
                min={0.01}
                max={resolving.escrow.amount - 0.01}
                value={refundAmount}
                onChange={setRefundAmount}
                placeholder="退给客户的金额"
              />
            )}
            <Input.TextArea
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="裁定说明（至少 10 字，对双方可见）"
              maxLength={5000}
              showCount
            />
          </>
        )}
      </Modal>
    </div>
  );
}
