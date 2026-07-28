import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, Spin, Tag, Typography, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getConversation, listConversations, sendMessage } from '../api/messages';
import { useAuthStore } from '../stores/auth';
import type { ChatMessage, Conversation } from '../types';

const { Text } = Typography;

const LIST_POLL_MS = 30_000;
const CHAT_POLL_MS = 8_000;

export default function Messages() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(() => {
    listConversations()
      .then(({ items }) => setConvs(items))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  const loadChat = useCallback((id: string, silent = false) => {
    if (!silent) setChatLoading(true);
    getConversation(id)
      .then(({ conversation, messages: msgs }) => {
        setActive(conversation);
        setMessages(msgs);
      })
      .catch(() => message.error(t('market.loadError')))
      .finally(() => setChatLoading(false));
  }, [t]);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) { setActive(null); setMessages([]); return undefined; }
    loadChat(selectedId);
    const timer = setInterval(() => loadChat(selectedId, true), CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedId, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !selectedId) return;
    setSending(true);
    try {
      await sendMessage(selectedId, body);
      setDraft('');
      loadChat(selectedId, true);
      loadList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || t('market.loadError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Typography.Title level={2}>{t('messages.title')}</Typography.Title>
      <div className="flex gap-4 items-stretch flex-col md:flex-row">
        {/* 会话列表 */}
        <Card className="md:w-80 w-full shrink-0" styles={{ body: { padding: 0 } }}>
          <Spin spinning={listLoading}>
            {convs.length === 0 && !listLoading ? (
              <Empty className="py-10" description={t('messages.empty')} />
            ) : (
              <List
                dataSource={convs}
                renderItem={(c) => (
                  <List.Item
                    className="cursor-pointer px-4"
                    style={{
                      background: c.id === selectedId ? 'rgba(37,99,235,0.08)' : undefined,
                      paddingLeft: 16, paddingRight: 16,
                    }}
                    onClick={() => setParams({ c: c.id })}
                  >
                    <List.Item.Meta
                      title={
                        <span className="flex items-center gap-2">
                          <span className="truncate">{c.counterpart?.name || '—'}</span>
                          {c.unread > 0 && <Badge count={c.unread} />}
                        </span>
                      }
                      description={
                        <>
                          <div className="truncate text-xs">{c.project?.title}</div>
                          {c.lastMessageText && (
                            <div className="truncate text-xs text-gray-400">{c.lastMessageText}</div>
                          )}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </Card>

        {/* 聊天窗 */}
        <Card className="flex-1" styles={{ body: { display: 'flex', flexDirection: 'column', height: 560, padding: 16 } }}>
          {!active ? (
            <Empty className="my-auto" description={t('messages.select')} />
          ) : (
            <>
              <div className="pb-2 mb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                <Text strong>{active.counterpart?.name || '—'}</Text>
                {active.project && (
                  <Link to={`/projects/${active.projectId}`}>
                    <Tag color="blue">{active.project.title}</Tag>
                  </Link>
                )}
              </div>
              <Spin spinning={chatLoading}>
                <div className="flex-1 overflow-y-auto pr-1" style={{ minHeight: 380, maxHeight: 420 }}>
                  {messages.map((m) => {
                    const mine = m.senderId === user?.id;
                    return (
                      <div key={m.id} className={`flex mb-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="px-3 py-2 rounded-2xl max-w-[75%] text-sm"
                          style={{
                            background: mine ? '#2563eb' : 'rgba(0,0,0,0.05)',
                            color: mine ? '#fff' : undefined,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {m.body}
                          <div
                            className="text-[10px] mt-1 text-right"
                            style={{ color: mine ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.35)' }}
                          >
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </Spin>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Input.TextArea
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={t('messages.placeholder')}
                  maxLength={10000}
                />
                <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>
                  {t('messages.send')}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
