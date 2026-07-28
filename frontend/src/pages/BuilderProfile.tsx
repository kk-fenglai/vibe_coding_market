import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Empty, Form, Input, InputNumber, List, Modal, Popconfirm,
  Select, Space, Spin, Tag, Typography, message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  createPortfolioItem, deletePortfolioItem, getMyBuilderProfile,
  listMyPortfolio, saveMyBuilderProfile, updatePortfolioItem,
} from '../api/builders';
import { AI_TOOLS, type BuilderProfilePayload, type PortfolioItem, type PortfolioPayload } from '../types';

const { Title, Paragraph } = Typography;

const AI_TOOL_LABELS: Record<string, string> = {
  CURSOR: 'Cursor',
  CLAUDE_CODE: 'Claude Code',
  LOVABLE: 'Lovable',
  BOLT: 'Bolt',
  V0: 'v0',
  WINDSURF: 'Windsurf',
  REPLIT_AGENT: 'Replit Agent',
};

export default function BuilderProfile() {
  const { t } = useTranslation();
  const [form] = Form.useForm<BuilderProfilePayload>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [itemModal, setItemModal] = useState<{ open: boolean; editing: PortfolioItem | null }>({ open: false, editing: null });
  const [itemSaving, setItemSaving] = useState(false);
  const [itemForm] = Form.useForm<PortfolioPayload>();

  const loadPortfolio = useCallback(() => {
    listMyPortfolio()
      .then(({ items }) => setPortfolio(items))
      .catch(() => setPortfolio([]));
  }, []);

  useEffect(() => {
    let alive = true;
    getMyBuilderProfile()
      .then((p) => {
        if (!alive || !p) return;
        setVerified(p.verified);
        setHasProfile(true);
        loadPortfolio();
        form.setFieldsValue({
          headline: p.headline ?? undefined,
          bio: p.bio ?? undefined,
          country: p.country ?? undefined,
          languages: p.languages,
          skills: p.skills,
          aiTools: p.aiTools,
          githubUrl: p.githubUrl ?? undefined,
          websiteUrl: p.websiteUrl ?? undefined,
          avatarUrl: p.avatarUrl ?? undefined,
        });
      })
      .catch(() => { if (alive) message.error(t('market.loadError')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [form, t, loadPortfolio]);

  const save = async (values: BuilderProfilePayload) => {
    setSaving(true);
    try {
      await saveMyBuilderProfile({
        ...values,
        languages: values.languages || [],
        skills: values.skills || [],
        aiTools: values.aiTools || [],
      });
      message.success(t('builder.saveOk'));
      if (!hasProfile) { setHasProfile(true); loadPortfolio(); }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setSaving(false);
    }
  };

  const openItemModal = (editing: PortfolioItem | null) => {
    setItemModal({ open: true, editing });
    if (editing) {
      itemForm.setFieldsValue({
        title: editing.title,
        summary: editing.summary ?? undefined,
        imageUrl: editing.imageUrl ?? undefined,
        demoUrl: editing.demoUrl ?? undefined,
        repoUrl: editing.repoUrl ?? undefined,
        figmaUrl: editing.figmaUrl ?? undefined,
        videoUrl: editing.videoUrl ?? undefined,
        sortOrder: editing.sortOrder,
      });
    } else {
      itemForm.resetFields();
    }
  };

  const saveItem = async () => {
    const values = await itemForm.validateFields();
    setItemSaving(true);
    try {
      if (itemModal.editing) {
        await updatePortfolioItem(itemModal.editing.id, values);
      } else {
        await createPortfolioItem(values);
      }
      message.success(t('builder.portfolioSaved'));
      setItemModal({ open: false, editing: null });
      loadPortfolio();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setItemSaving(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deletePortfolioItem(id);
      message.success(t('builder.portfolioDeleted'));
      loadPortfolio();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Title level={2} style={{ marginBottom: 0 }}>{t('builder.title')}</Title>
        {verified && <Tag color="gold">{t('builder.verified')}</Tag>}
      </div>
      <Paragraph type="secondary" className="mb-4">{t('builder.hint')}</Paragraph>

      <Card>
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={save} disabled={loading}>
            <Form.Item name="headline" label={t('builder.headline')}>
              <Input placeholder={t('builder.headlinePlaceholder')} maxLength={120} showCount />
            </Form.Item>
            <Form.Item name="bio" label={t('builder.bio')}>
              <Input.TextArea rows={4} placeholder={t('builder.bioPlaceholder')} maxLength={5000} />
            </Form.Item>
            <Form.Item name="aiTools" label={t('builder.aiTools')}>
              <Select
                mode="multiple"
                allowClear
                options={AI_TOOLS.map((v) => ({ value: v, label: AI_TOOL_LABELS[v] }))}
              />
            </Form.Item>
            <Form.Item name="skills" label={t('builder.skills')}>
              <Select mode="tags" tokenSeparators={[',']} placeholder={t('builder.skillsPlaceholder')} open={false} />
            </Form.Item>
            <Form.Item name="languages" label={t('builder.languages')}>
              <Select
                mode="multiple"
                allowClear
                options={[
                  { value: 'zh', label: '中文' },
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ]}
              />
            </Form.Item>
            <Form.Item name="githubUrl" label="GitHub" rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
              <Input placeholder="https://github.com/..." />
            </Form.Item>
            <Form.Item name="websiteUrl" label={t('builder.websiteUrl')} rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
              <Input placeholder="https://" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>{t('builder.save')}</Button>
          </Form>
        </Spin>
      </Card>

      {hasProfile && (
        <Card
          className="mt-4"
          title={t('builder.portfolioTitle')}
          extra={<Button type="primary" size="small" onClick={() => openItemModal(null)}>{t('builder.portfolioAdd')}</Button>}
        >
          {portfolio.length === 0 ? (
            <Empty description={t('builder.portfolioEmpty')} />
          ) : (
            <List
              dataSource={portfolio}
              renderItem={(p) => (
                <List.Item
                  actions={[
                    <Button key="edit" size="small" onClick={() => openItemModal(p)}>{t('market.mine.edit')}</Button>,
                    <Popconfirm key="del" title={t('builder.portfolioDeleteAsk')} onConfirm={() => removeItem(p.id)}>
                      <Button size="small" danger>{t('builder.portfolioDelete')}</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <span>{p.title}</span>
                        {p.projectId && <Tag color="green">{t('builderPublic.platformDelivery')}</Tag>}
                      </Space>
                    }
                    description={
                      <>
                        {p.summary && <div>{p.summary}</div>}
                        <Space wrap size="small">
                          {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noopener noreferrer">Demo ↗</a>}
                          {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">Repo ↗</a>}
                          {p.figmaUrl && <a href={p.figmaUrl} target="_blank" rel="noopener noreferrer">Figma ↗</a>}
                          {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noopener noreferrer">Video ↗</a>}
                        </Space>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      <Modal
        open={itemModal.open}
        title={itemModal.editing ? t('builder.portfolioEdit') : t('builder.portfolioAdd')}
        onCancel={() => setItemModal({ open: false, editing: null })}
        onOk={saveItem}
        confirmLoading={itemSaving}
        okText={t('builder.save')}
        destroyOnClose
      >
        <Form form={itemForm} layout="vertical" className="mt-4">
          <Form.Item
            name="title"
            label={t('builder.portfolioItemTitle')}
            rules={[{ required: true, message: t('market.form.required') }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="summary" label={t('builder.portfolioSummary')}>
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="imageUrl" label={t('builder.portfolioImage')} rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item name="demoUrl" label="Demo" rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item name="repoUrl" label="Repo" rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
            <Input placeholder="https://github.com/..." />
          </Form.Item>
          <Form.Item name="figmaUrl" label="Figma" rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
            <Input placeholder="https://figma.com/..." />
          </Form.Item>
          <Form.Item name="videoUrl" label="Video" rules={[{ type: 'url', message: t('builder.urlInvalid') }]}>
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('builder.portfolioSort')} initialValue={0}>
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
