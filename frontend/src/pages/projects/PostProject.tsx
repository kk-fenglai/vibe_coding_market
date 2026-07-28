import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, InputNumber, Switch, Button, Space, Typography,
  Row, Col, message, Spin,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createProject, getProject, submitProject, updateProject } from '../../api/projects';
import {
  PROJECT_CATEGORIES, CURRENCIES, DELIVERY_DAYS,
  type ProjectPayload, type ProjectAttachment,
} from '../../types';

const { Title, Paragraph, Text } = Typography;

type FormValues = Omit<ProjectPayload, 'attachments'> & { attachments?: ProjectAttachment[] };

export default function PostProject() {
  const { id } = useParams();               // 有 id = 编辑草稿/被驳回的任务
  const isEdit = !!id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((p) => {
        form.setFieldsValue({
          title: p.title,
          description: p.description,
          category: p.category,
          budgetMin: p.budgetMin ?? undefined,
          budgetMax: p.budgetMax ?? undefined,
          currency: p.currency,
          deliveryDays: p.deliveryDays,
          urgent: p.urgent,
          languageReq: p.languageReq ?? undefined,
          stackPref: p.stackPref,
          tags: p.tags,
          attachments: p.attachments ?? [],
        });
      })
      .catch(() => message.error(t('market.detail.notFound')))
      .finally(() => setLoading(false));
  }, [id, form, t]);

  const buildPayload = (v: FormValues): ProjectPayload => ({
    ...v,
    stackPref: v.stackPref || [],
    tags: v.tags || [],
    attachments: (v.attachments || []).filter((a) => a?.name && a?.url),
  });

  const save = async (submit: boolean) => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;   // AntD 已在字段上标红
    }
    if (values.budgetMin == null && values.budgetMax == null) {
      message.error(t('market.form.budgetRequired'));
      return;
    }
    if (values.budgetMin != null && values.budgetMax != null && values.budgetMin > values.budgetMax) {
      message.error(t('market.form.budgetOrder'));
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(values);
      if (isEdit) {
        await updateProject(id!, payload);
        if (submit) await submitProject(id!);
      } else {
        await createProject(payload, submit);
      }
      message.success(submit ? t('market.form.submitted') : t('market.form.savedDraft'));
      navigate('/my/projects');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Title level={2}>{isEdit ? t('market.form.editTitle') : t('market.form.newTitle')}</Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ currency: 'CNY', deliveryDays: 7, urgent: false, stackPref: [], tags: [], attachments: [] }}
        >
          <Form.Item
            name="title"
            label={t('market.form.title')}
            rules={[{ required: true, message: t('market.form.required') }, { min: 5, message: t('market.form.titleLen') }]}
          >
            <Input maxLength={120} showCount placeholder={t('market.form.titlePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('market.form.description')}
            rules={[{ required: true, message: t('market.form.required') }, { min: 20, message: t('market.form.descLen') }]}
          >
            <Input.TextArea rows={10} maxLength={20000} showCount placeholder={t('market.form.descriptionPlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="category" label={t('market.form.category')} rules={[{ required: true, message: t('market.form.required') }]}>
                <Select options={PROJECT_CATEGORIES.map((c) => ({ value: c, label: t(`market.cat.${c}`) }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="deliveryDays" label={t('market.form.delivery')} rules={[{ required: true, message: t('market.form.required') }]}>
                <Select options={DELIVERY_DAYS.map((d) => ({ value: d, label: t('market.days', { count: d }) }))} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('market.form.budget')} required>
            <Space.Compact className="w-full">
              <Form.Item name="budgetMin" noStyle>
                <InputNumber className="w-1/3" min={1} placeholder={t('market.budgetMin')} />
              </Form.Item>
              <Form.Item name="budgetMax" noStyle>
                <InputNumber className="w-1/3" min={1} placeholder={t('market.budgetMax')} />
              </Form.Item>
              <Form.Item name="currency" noStyle>
                <Select className="w-1/3" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </Space.Compact>
            <Text type="secondary" className="text-xs">{t('market.form.budgetHint')}</Text>
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="languageReq" label={t('market.form.language')}>
                <Input maxLength={40} placeholder={t('market.form.languagePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="urgent" label={t('market.form.urgent')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="stackPref" label={t('market.form.stack')}>
            <Select mode="tags" tokenSeparators={[',']} placeholder={t('market.form.stackPlaceholder')} maxCount={10} />
          </Form.Item>

          <Form.Item name="tags" label={t('market.form.tags')}>
            <Select mode="tags" tokenSeparators={[',']} maxCount={10} />
          </Form.Item>

          <Form.Item label={t('market.form.attachments')}>
            <Form.List name="attachments">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" className="flex mb-2">
                      <Form.Item name={[field.name, 'name']} noStyle>
                        <Input placeholder={t('market.form.attachmentName')} style={{ width: 140 }} maxLength={200} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'url']}
                        noStyle
                        rules={[{ type: 'url', message: 'URL' }]}
                      >
                        <Input placeholder="https://…" style={{ width: 320 }} maxLength={1000} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  {fields.length < 10 && (
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      {t('market.form.addAttachment')}
                    </Button>
                  )}
                </>
              )}
            </Form.List>
          </Form.Item>

          <Paragraph type="secondary" className="text-xs">
            {t('market.form.submitted')}
          </Paragraph>

          <Space>
            <Button onClick={() => save(false)} loading={saving}>{t('market.form.saveDraft')}</Button>
            <Button type="primary" onClick={() => save(true)} loading={saving}>{t('market.form.submit')}</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
