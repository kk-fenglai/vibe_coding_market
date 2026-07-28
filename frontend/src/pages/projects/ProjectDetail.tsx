import { useCallback, useEffect, useState } from 'react';
import {
  Card, Tag, Typography, Space, Button, Descriptions, Spin, Result, Alert, message,
  Modal, Form, InputNumber, Input, List, Popconfirm, Rate,
} from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProject } from '../../api/projects';
import {
  applyToProject, listProjectApplications, acceptApplication, rejectApplication,
  deliverProject, confirmProject, requestChanges,
} from '../../api/applications';
import { openConversation } from '../../api/messages';
import { useAuthStore } from '../../stores/auth';
import EscrowPanel from '../../components/EscrowPanel';
import ReviewSection from '../../components/ReviewSection';
import type { Application, ApplicationPayload, Project } from '../../types';

const { Title, Paragraph, Text } = Typography;

function money(v: number | null | undefined, currency: string) {
  if (v == null) return '—';
  const c = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '€';
  return `${c}${v.toLocaleString()}`;
}

type ApiError = { response?: { data?: { error?: string; code?: string } } };

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [applyForm] = Form.useForm<ApplicationPayload>();
  const [deliverForm] = Form.useForm<{ deliveryNote: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProject(id);
      setProject(p);
      if (p.isOwner && p.applicationCount > 0) {
        const { items } = await listProjectApplications(id);
        setApplications(items);
      } else {
        setApplications([]);
      }
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      load();
    } catch (e: unknown) {
      message.error((e as ApiError).response?.data?.error || t('market.loadError'));
    }
  };

  const submitApply = async () => {
    const values = await applyForm.validateFields();
    setApplying(true);
    try {
      await applyToProject(id, values);
      message.success(t('market.detail.applyOk'));
      setApplyOpen(false);
      applyForm.resetFields();
      load();
    } catch (e: unknown) {
      const err = e as ApiError;
      if (err.response?.data?.code === 'NO_BUILDER_PROFILE') {
        message.info(t('market.detail.needProfile'));
        navigate('/builder/profile');
      } else {
        message.error(err.response?.data?.error || t('market.loadError'));
      }
    } finally {
      setApplying(false);
    }
  };

  const goChat = async (builderId?: string) => {
    try {
      const conv = await openConversation(id, builderId);
      navigate(`/messages?c=${conv.id}`);
    } catch (e: unknown) {
      message.error((e as ApiError).response?.data?.error || t('market.loadError'));
    }
  };

  const submitDeliver = async () => {
    const { deliveryNote } = await deliverForm.validateFields();
    setDelivering(true);
    try {
      await deliverProject(id, deliveryNote);
      message.success(t('market.detail.deliverOk'));
      deliverForm.resetFields();
      load();
    } catch (e: unknown) {
      message.error((e as ApiError).response?.data?.error || t('market.loadError'));
    } finally {
      setDelivering(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  if (!project) {
    return (
      <Result
        status="404"
        title={t('market.detail.notFound')}
        extra={<Link to="/projects"><Button type="primary">{t('market.detail.backToMarket')}</Button></Link>}
      />
    );
  }

  const budget = project.budgetMin != null && project.budgetMax != null && project.budgetMin !== project.budgetMax
    ? `${money(project.budgetMin, project.currency)} – ${money(project.budgetMax, project.currency)}`
    : money(project.budgetMax ?? project.budgetMin, project.currency);

  const canAccept = project.status === 'OPEN';

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/projects"><Button type="link" className="px-0 mb-2">← {t('market.detail.backToMarket')}</Button></Link>

      <Card>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <Title level={3} style={{ marginBottom: 8 }}>{project.title}</Title>
          <Space>
            {project.urgent && <Tag color="red">{t('market.urgent')}</Tag>}
            <Tag color="processing">{t(`market.status.${project.status}`)}</Tag>
          </Space>
        </div>

        <Space wrap size={[4, 8]} className="mb-4">
          <Tag color="blue">{t(`market.cat.${project.category}`)}</Tag>
          <Tag>{t('market.deliveryIn', { count: project.deliveryDays })}</Tag>
          {project.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>

        {project.isOwner && project.status === 'REJECTED' && project.reviewNote && (
          <Alert
            type="warning"
            className="mb-4"
            message={t('market.detail.reviewNote')}
            description={project.reviewNote}
            showIcon
          />
        )}

        <Descriptions column={{ xs: 1, md: 2 }} bordered size="small" className="mb-4">
          <Descriptions.Item label={t('market.detail.budget')}>{budget}</Descriptions.Item>
          <Descriptions.Item label={t('market.detail.delivery')}>
            {t('market.days', { count: project.deliveryDays })}
          </Descriptions.Item>
          <Descriptions.Item label={t('market.detail.client')}>
            {project.client?.name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('market.detail.language')}>
            {project.languageReq || '—'}
          </Descriptions.Item>
          {project.dueAt && (project.isOwner || project.isHiredBuilder) && (
            <Descriptions.Item label={t('market.detail.dueAt')}>
              {new Date(project.dueAt).toLocaleDateString()}
            </Descriptions.Item>
          )}
          {project.stackPref.length > 0 && (
            <Descriptions.Item label={t('market.detail.stack')} span={2}>
              <Space wrap>{project.stackPref.map((s) => <Tag key={s}>{s}</Tag>)}</Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Title level={5}>{t('market.detail.description')}</Title>
        {/* Markdown 正文暂按纯文本换行渲染；富文本渲染随聊天模块一起接入。 */}
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{project.description}</Paragraph>

        {!!project.attachments?.length && (
          <>
            <Title level={5}>{t('market.detail.attachments')}</Title>
            <Space direction="vertical">
              {project.attachments.map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.name} ↗
                </a>
              ))}
            </Space>
          </>
        )}

        {project.deliveryNote && (project.isOwner || project.isHiredBuilder) && (
          <Alert
            type="info"
            className="mt-4"
            message={t('market.detail.deliveryNote')}
            description={<span style={{ whiteSpace: 'pre-wrap' }}>{project.deliveryNote}</span>}
            showIcon
          />
        )}

        {/* Builder：申请入口 */}
        {project.status === 'OPEN' && !project.isOwner && (
          <div className="mt-6">
            <Space wrap>
              <Button
                type="primary"
                size="large"
                disabled={project.hasApplied}
                onClick={() => (user ? setApplyOpen(true) : navigate('/login'))}
              >
                {project.hasApplied ? t('market.applied') : t('market.detail.apply')}
              </Button>
              {project.hasApplied && (
                <Button size="large" onClick={() => goChat()}>{t('messages.contactClient')}</Button>
              )}
            </Space>
            <Text type="secondary" className="ml-3">
              {t('market.applicants', { count: project.applicationCount })}
            </Text>
          </div>
        )}

        {/* 受雇 Builder：任何阶段可联系客户 */}
        {project.isHiredBuilder && project.status !== 'OPEN' && (
          <div className="mt-4">
            <Button onClick={() => goChat()}>{t('messages.contactClient')}</Button>
          </div>
        )}

        {/* 受雇 Builder：提交交付 */}
        {project.isHiredBuilder && project.status === 'IN_PROGRESS' && (
          <Card size="small" className="mt-6" title={t('market.detail.deliver')}>
            <Form form={deliverForm} layout="vertical" onFinish={submitDeliver}>
              <Form.Item
                name="deliveryNote"
                rules={[{ required: true, min: 10, message: t('market.detail.deliverLen') }]}
              >
                <Input.TextArea rows={4} placeholder={t('market.detail.deliverPlaceholder')} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={delivering}>
                {t('market.detail.deliver')}
              </Button>
            </Form>
          </Card>
        )}

        {/* 业主：验收 / 打回返工 */}
        {project.isOwner && project.status === 'REVIEW' && (
          <Space className="mt-6">
            <Popconfirm title={t('market.detail.confirmAsk')} onConfirm={() => act(() => confirmProject(id), t('market.detail.confirmOk'))}>
              <Button type="primary" size="large">{t('market.detail.confirm')}</Button>
            </Popconfirm>
            <Button size="large" onClick={() => act(() => requestChanges(id), t('market.detail.requestChangesOk'))}>
              {t('market.detail.requestChanges')}
            </Button>
          </Space>
        )}

        <EscrowPanel project={project} onChanged={load} />
      </Card>

      <ReviewSection project={project} />

      {/* 业主：收到的申请 */}
      {project.isOwner && applications.length > 0 && (
        <Card className="mt-4" title={t('market.apps.title')}>
          <List
            dataSource={applications}
            renderItem={(a) => {
              const bp = a.builder?.builderProfile;
              const avg = bp && bp.ratingCount > 0 ? bp.ratingSum / bp.ratingCount : null;
              return (
                <List.Item
                  actions={a.status === 'PENDING' && canAccept ? [
                    <Popconfirm
                      key="accept"
                      title={t('market.apps.acceptAsk')}
                      onConfirm={() => act(() => acceptApplication(a.id), t('market.apps.acceptOk'))}
                    >
                      <Button type="primary" size="small">{t('market.apps.accept')}</Button>
                    </Popconfirm>,
                    <Button
                      key="reject"
                      size="small"
                      danger
                      onClick={() => act(() => rejectApplication(a.id), t('market.apps.rejectOk'))}
                    >
                      {t('market.apps.reject')}
                    </Button>,
                    <Button key="chat" size="small" onClick={() => goChat(a.builderId)}>
                      {t('messages.contactBuilder')}
                    </Button>,
                  ] : [
                    <Tag key="st">{t(`market.apps.status.${a.status}`)}</Tag>,
                    ...(a.status !== 'WITHDRAWN' ? [
                      <Button key="chat" size="small" onClick={() => goChat(a.builderId)}>
                        {t('messages.contactBuilder')}
                      </Button>,
                    ] : []),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Link to={`/builders/${a.builderId}`}>{a.builder?.name || '—'}</Link>
                        {bp?.verified && <Tag color="gold">{t('market.apps.verified')}</Tag>}
                        {bp && <Text type="secondary">{t('market.apps.completed', { count: bp.completedCount })}</Text>}
                        {avg != null && <Rate disabled allowHalf value={Math.round(avg * 2) / 2} style={{ fontSize: 14 }} />}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        {bp?.headline && <Text>{bp.headline}</Text>}
                        <Space wrap size={[4, 4]}>
                          {(bp?.aiTools || []).map((tool) => <Tag key={tool} color="blue">{tool}</Tag>)}
                          {(bp?.skills || []).slice(0, 6).map((s) => <Tag key={s}>{s}</Tag>)}
                        </Space>
                        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>{a.pitch}</Text>
                        {a.portfolioUrl && (
                          <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer">{a.portfolioUrl} ↗</a>
                        )}
                        <Text strong>
                          {t('market.apps.bid')}: {money(a.bidAmount, a.currency)} · {t('market.apps.days', { count: a.estimatedDays })}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {/* Builder：申请弹窗 */}
      <Modal
        open={applyOpen}
        title={t('market.detail.applyTitle')}
        onCancel={() => setApplyOpen(false)}
        onOk={submitApply}
        confirmLoading={applying}
        okText={t('market.detail.applySubmit')}
        destroyOnClose
      >
        <Form form={applyForm} layout="vertical" className="mt-4">
          <Form.Item
            name="bidAmount"
            label={`${t('market.detail.bidAmount')} (${project.currency})`}
            rules={[{ required: true, message: t('market.form.required') }]}
          >
            <InputNumber min={1} max={9999999} className="w-full" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="estimatedDays"
            label={t('market.detail.estimatedDays')}
            rules={[{ required: true, message: t('market.form.required') }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="pitch"
            label={t('market.detail.pitch')}
            rules={[{ required: true, min: 10, message: t('market.detail.pitchLen') }]}
          >
            <Input.TextArea rows={4} placeholder={t('market.detail.pitchPlaceholder')} maxLength={2000} showCount />
          </Form.Item>
          <Form.Item
            name="portfolioUrl"
            label={t('market.detail.portfolioUrl')}
            rules={[{ type: 'url', message: t('market.form.required') }]}
          >
            <Input placeholder="https://" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
