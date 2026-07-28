import { useEffect, useState } from 'react';
import { Card, Col, Row, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { getWallet } from '../api/escrow';
import type { WalletInfo } from '../types';

const { Title } = Typography;

const TYPE_COLOR: Record<string, string> = {
  DEPOSIT: 'green',
  ESCROW_HOLD: 'gold',
  ESCROW_RELEASE: 'blue',
  PLATFORM_FEE: 'default',
  REFUND: 'purple',
  WITHDRAWAL: 'red',
};

export default function Wallet() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getWallet()
      .then((w) => { if (alive) setInfo(w); })
      .catch(() => { if (alive) message.error(t('market.loadError')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [t]);

  const sym = (c: string) => (c === 'CNY' ? '¥' : c === 'USD' ? '$' : '€');

  const columns: ColumnsType<WalletInfo['ledger'][number]> = [
    {
      title: t('wallet.time'),
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('wallet.type'),
      dataIndex: 'type',
      render: (v: string) => <Tag color={TYPE_COLOR[v]}>{t(`wallet.types.${v}`)}</Tag>,
    },
    {
      title: t('wallet.amount'),
      dataIndex: 'amount',
      align: 'right',
      render: (v: number, r) => (
        <span style={{ color: v >= 0 ? '#16a34a' : '#dc2626' }}>
          {v >= 0 ? '+' : ''}{sym(r.currency)}{Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('wallet.note'),
      dataIndex: 'note',
      responsive: ['md'],
      render: (v?: string) => v || '—',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Title level={2}>{t('wallet.title')}</Title>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={12} md={8}>
            <Card>
              <Statistic
                title={t('wallet.balance')}
                value={info?.wallet.balance ?? 0}
                precision={2}
                prefix={sym(info?.wallet.currency || 'CNY')}
              />
            </Card>
          </Col>
          <Col xs={12} md={8}>
            <Card>
              <Statistic
                title={t('wallet.held')}
                value={info?.wallet.held ?? 0}
                precision={2}
                prefix={sym(info?.wallet.currency || 'CNY')}
              />
            </Card>
          </Col>
        </Row>
        <Card title={t('wallet.ledger')}>
          <Table
            rowKey="id"
            dataSource={info?.ledger || []}
            columns={columns}
            pagination={false}
            locale={{ emptyText: t('wallet.empty') }}
            size="small"
          />
        </Card>
      </Spin>
    </div>
  );
}
