import { useEffect, useState } from 'react';
import { Spin, Table, message } from 'antd';
import { WalletOutlined, LockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { getWallet } from '../api/escrow';
import type { WalletInfo } from '../types';

// 类型徽章配色：绿=入账，橙=托管，灰=出账，紫=退款
const TYPE_STYLE: Record<string, { bg: string; dot: string; text: string }> = {
  DEPOSIT: { bg: '#ecfdf5', dot: '#10b981', text: '#065f46' },
  ESCROW_HOLD: { bg: '#fff7ed', dot: '#f97316', text: '#9a3412' },
  ESCROW_RELEASE: { bg: '#ecfdf5', dot: '#10b981', text: '#065f46' },
  PLATFORM_FEE: { bg: '#f1f5f9', dot: '#64748b', text: '#475569' },
  REFUND: { bg: '#faf5ff', dot: '#a855f7', text: '#6b21a8' },
  WITHDRAWAL: { bg: '#f1f5f9', dot: '#64748b', text: '#475569' },
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
  const cur = info?.wallet.currency || 'CNY';

  const columns: ColumnsType<WalletInfo['ledger'][number]> = [
    {
      title: t('wallet.time'),
      dataIndex: 'createdAt',
      render: (v: string) => <span className="text-sm text-hub-body">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: t('wallet.type'),
      dataIndex: 'type',
      render: (v: string) => {
        const s = TYPE_STYLE[v] || TYPE_STYLE.PLATFORM_FEE;
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: s.bg, color: s.text }}
          >
            <span className="inline-block rounded-full" style={{ background: s.dot, width: 6, height: 6 }} />
            {t(`wallet.types.${v}`)}
          </span>
        );
      },
    },
    {
      title: t('wallet.amount'),
      dataIndex: 'amount',
      align: 'right',
      render: (v: number, r) => (
        <span className="text-base font-medium" style={{ color: v >= 0 ? '#10b981' : '#0b1c30' }}>
          {v >= 0 ? '+' : '- '}{sym(r.currency)}{Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('wallet.note'),
      dataIndex: 'note',
      responsive: ['md'],
      render: (v?: string) => <span className="text-sm text-hub-body">{v || '—'}</span>,
    },
  ];

  return (
    <div className="max-w-[1216px] mx-auto flex flex-col gap-12">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl md:text-5xl font-bold text-hub-heading tracking-[-0.96px] m-0">
          {t('wallet.title')}
        </h1>
      </div>

      <Spin spinning={loading}>
        {/* ── Balance & held ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="relative overflow-hidden bg-white rounded-2xl shadow-soft p-[25px]">
            <div
              className="absolute rounded-full pointer-events-none"
              style={{ background: '#ff6b00', opacity: 0.2, filter: 'blur(30px)', width: 128, height: 128, right: -40, top: -40 }}
            />
            <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-[0.7px] text-hub-body">
              <WalletOutlined /> {t('wallet.balance')}
            </div>
            <div className="text-5xl font-bold text-hub-heading tracking-[-0.96px] leading-[72px]">
              {sym(cur)}{(info?.wallet.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5">
              <h2 className="text-2xl font-semibold text-hub-heading tracking-[-0.24px] m-0">
                {t('wallet.held')}
              </h2>
              <span className="bg-[#ffecd6] text-hub-logo text-xs font-bold px-2 py-0.5 rounded-md">
                {t('wallet.types.ESCROW_HOLD')}
              </span>
            </div>
            <div className="flex items-center gap-6 p-6">
              <div className="bg-[#d3e4fe] rounded-xl flex items-center justify-center shrink-0" style={{ width: 40, height: 40 }}>
                <LockOutlined className="text-lg text-hub-heading" />
              </div>
              <div className="text-4xl font-bold text-hub-heading tracking-[-0.96px]">
                {sym(cur)}{(info?.wallet.held ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Transaction history ── */}
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-2xl font-semibold text-hub-heading tracking-[-0.24px] m-0">
              {t('wallet.ledger')}
            </h2>
          </div>
          <Table
            rowKey="id"
            dataSource={info?.ledger || []}
            columns={columns}
            pagination={false}
            locale={{ emptyText: t('wallet.empty') }}
          />
        </div>
      </Spin>
    </div>
  );
}
