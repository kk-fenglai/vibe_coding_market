import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { fundProjectEscrow, getProjectEscrow, raiseDispute } from '../api/escrow';
import type { Escrow, Project } from '../types';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'gold',
  HELD: 'blue',
  DISPUTED: 'red',
  RELEASED: 'success',
  REFUNDED: 'default',
  CANCELLED: 'default',
};

function money(v: number, currency: string) {
  const c = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '€';
  return `${c}${v.toLocaleString()}`;
}

// 托管支付面板：仅任务双方可见（后端 404 时不渲染）。
// project 状态变化（验收/打回等）由父组件驱动重载，onChanged 反向通知父组件刷新任务。
export default function EscrowPanel({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const { t } = useTranslation();
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [funding, setFunding] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeForm] = Form.useForm<{ reason: string }>();

  const load = useCallback(() => {
    getProjectEscrow(project.id)
      .then(setEscrow)
      .catch(() => setEscrow(null));
  }, [project.id]);

  useEffect(() => { load(); }, [load, project.status]);

  if (!escrow || (!project.isOwner && !project.isHiredBuilder)) return null;

  const fund = async () => {
    setFunding(true);
    try {
      await fundProjectEscrow(project.id);
      message.success(t('escrow.fundOk'));
      load();
      onChanged();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setFunding(false);
    }
  };

  const submitDispute = async () => {
    const { reason } = await disputeForm.validateFields();
    setDisputing(true);
    try {
      await raiseDispute(project.id, reason);
      message.success(t('escrow.disputeOk'));
      setDisputeOpen(false);
      disputeForm.resetFields();
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setDisputing(false);
    }
  };

  return (
    <Card
      size="small"
      className="mt-6"
      title={t('escrow.title')}
      extra={<Tag color={STATUS_COLOR[escrow.status]}>{t(`escrow.status.${escrow.status}`)}</Tag>}
    >
      <Descriptions column={{ xs: 1, md: 3 }} size="small">
        <Descriptions.Item label={t('escrow.amount')}>{money(escrow.amount, escrow.currency)}</Descriptions.Item>
        <Descriptions.Item label={t('escrow.fee', { rate: (escrow.feeRate * 100).toFixed(0) })}>
          {money(escrow.platformFee, escrow.currency)}
        </Descriptions.Item>
        <Descriptions.Item label={t('escrow.payout')}>{money(escrow.builderPayout, escrow.currency)}</Descriptions.Item>
      </Descriptions>

      {escrow.status === 'PENDING' && project.isOwner && (
        <div className="mt-3">
          <Popconfirm title={t('escrow.fundAsk', { amount: money(escrow.amount, escrow.currency) })} onConfirm={fund}>
            <Button type="primary" loading={funding}>{t('escrow.fund')}</Button>
          </Popconfirm>
          <span className="ml-3 text-gray-500 text-sm">{t('escrow.mockHint')}</span>
        </div>
      )}
      {escrow.status === 'PENDING' && project.isHiredBuilder && (
        <Alert className="mt-3" type="warning" showIcon message={t('escrow.waitingPayment')} />
      )}

      {escrow.status === 'HELD' && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {escrow.autoConfirmAt && project.status === 'REVIEW' && (
            <span className="text-gray-500 text-sm">
              {t('escrow.autoConfirmAt', { date: new Date(escrow.autoConfirmAt).toLocaleDateString() })}
            </span>
          )}
          <Button danger size="small" onClick={() => setDisputeOpen(true)}>{t('escrow.dispute')}</Button>
        </div>
      )}

      {escrow.dispute && (
        <Alert
          className="mt-3"
          type={escrow.dispute.status === 'OPEN' ? 'error' : 'info'}
          showIcon
          message={t(`escrow.disputeStatus.${escrow.dispute.status}`)}
          description={
            <>
              <div style={{ whiteSpace: 'pre-wrap' }}>{escrow.dispute.reason}</div>
              {escrow.dispute.resolution && (
                <div className="mt-2">
                  <b>{t('escrow.resolution')}:</b> {escrow.dispute.resolution}
                </div>
              )}
            </>
          }
        />
      )}

      {escrow.status === 'RELEASED' && (
        <Alert
          className="mt-3"
          type="success"
          showIcon
          message={t('escrow.released', { amount: money(escrow.builderPayout, escrow.currency) })}
        />
      )}
      {escrow.status === 'REFUNDED' && (
        <Alert className="mt-3" type="info" showIcon message={t('escrow.refunded')} />
      )}

      <Modal
        open={disputeOpen}
        title={t('escrow.disputeTitle')}
        onCancel={() => setDisputeOpen(false)}
        onOk={submitDispute}
        confirmLoading={disputing}
        okText={t('escrow.dispute')}
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={disputeForm} layout="vertical" className="mt-4">
          <Form.Item
            name="reason"
            label={t('escrow.disputeReason')}
            rules={[{ required: true, min: 20, message: t('escrow.disputeReasonLen') }]}
          >
            <Input.TextArea rows={5} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
