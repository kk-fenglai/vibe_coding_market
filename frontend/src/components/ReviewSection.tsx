import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, List, Rate, Space, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getProjectReviews, submitReview } from '../api/reviews';
import type { Project, Review, ReviewPayload } from '../types';

const DIMENSIONS = ['communication', 'speed', 'codeQuality', 'aiSkill', 'delivery'] as const;

// 双向盲评区：任务完成后双方各评一次，双方都提交后才互相可见。
export default function ReviewSection({ project }: { project: Project }) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ReviewPayload>();

  const isParticipant = project.isOwner || project.isHiredBuilder;

  const load = useCallback(() => {
    getProjectReviews(project.id)
      .then(({ items, myReview: mine }) => { setReviews(items); setMyReview(mine); })
      .catch(() => { setReviews([]); setMyReview(null); });
  }, [project.id]);

  useEffect(() => {
    if (project.status === 'COMPLETED') load();
  }, [load, project.status]);

  if (project.status !== 'COMPLETED') return null;
  if (!isParticipant && reviews.length === 0) return null;

  const submit = async (values: ReviewPayload) => {
    setSubmitting(true);
    try {
      await submitReview(project.id, values);
      message.success(t('review.submitted'));
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-4" title={t('review.title')}>
      {isParticipant && !myReview && (
        <Form form={form} layout="vertical" onFinish={submit} className="mb-4">
          <Form.Item
            name="rating"
            label={t('review.rating')}
            rules={[{ required: true, message: t('market.form.required') }]}
          >
            <Rate />
          </Form.Item>
          {project.isOwner && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {DIMENSIONS.map((d) => (
                <Form.Item key={d} name={d} label={t(`review.dims.${d}`)} className="mb-2">
                  <Rate />
                </Form.Item>
              ))}
            </div>
          )}
          <Form.Item name="comment" label={t('review.comment')}>
            <Input.TextArea rows={3} maxLength={3000} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>{t('review.submit')}</Button>
        </Form>
      )}

      {myReview && !myReview.publishedAt && (
        <Alert type="info" showIcon className="mb-4" message={t('review.waitingOther')} />
      )}

      <List
        dataSource={reviews}
        locale={{ emptyText: t('review.none') }}
        renderItem={(r) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space wrap>
                  <span>{r.author?.name || '—'}</span>
                  <Tag>{t(`review.direction.${r.direction}`)}</Tag>
                  <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
                </Space>
              }
              description={
                <>
                  {r.direction === 'CLIENT_TO_BUILDER' && (
                    <Space wrap size={[12, 4]} className="mb-1">
                      {DIMENSIONS.filter((d) => r[d] != null).map((d) => (
                        <span key={d} className="text-xs text-gray-500">
                          {t(`review.dims.${d}`)} {r[d]}/5
                        </span>
                      ))}
                    </Space>
                  )}
                  {r.comment && <div style={{ whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
                </>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
