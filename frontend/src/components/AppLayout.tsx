import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, theme as antdTheme, Drawer, Grid, Badge } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserOutlined, MenuOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getUnreadCount } from '../api/messages';
import { useAuthStore } from '../stores/auth';
import LanguageSwitcher from './LanguageSwitcher';
import FeedbackWidget from './FeedbackWidget';

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

export default function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { token } = antdTheme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);
  const go = (path: string) => { navigate(path); closeDrawer(); };

  // 私信未读角标：登录后轮询
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    const poll = () => getUnreadCount().then(setUnread).catch(() => {});
    poll();
    const timer = setInterval(poll, 30_000);
    return () => clearInterval(timer);
  }, [user, location.pathname]);

  // BuilderHub 导航 —— 「我的任务/投标/私信」仅登录后出现
  const navItems = [
    { key: '/', label: <Link to="/">{t('nav.home')}</Link> },
    { key: '/projects', label: <Link to="/projects">{t('nav.marketplace')}</Link> },
    { key: '/projects/new', label: <Link to="/projects/new">{t('nav.postProject')}</Link> },
    ...(user ? [
      { key: '/my/projects', label: <Link to="/my/projects">{t('nav.myProjects')}</Link> },
      { key: '/my/applications', label: <Link to="/my/applications">{t('nav.myApplications')}</Link> },
      {
        key: '/messages',
        label: (
          <Link to="/messages">
            <Badge count={unread} size="small" offset={[8, -2]}>{t('nav.messages')}</Badge>
          </Link>
        ),
      },
    ] : []),
  ];

  const userMenu = {
    items: [
      { key: 'builderProfile', label: t('nav.builderProfile'), onClick: () => navigate('/builder/profile') },
      { key: 'wallet', label: t('nav.wallet'), onClick: () => navigate('/wallet') },
      { key: 'changePassword', label: t('nav.changePassword'), onClick: () => navigate('/change-password') },
      { key: 'logout', label: t('nav.logout'), onClick: () => { logout(); navigate('/'); } },
    ],
  };

  return (
    <Layout className="min-h-screen" style={{ background: token.colorBgBase }}>
      <Header
        className="flex items-center px-4 md:px-6"
        style={{
          background: token.colorBgContainer,
        }}
      >
        <div className="font-bold text-lg flex-1 md:flex-none md:mr-8 truncate" style={{ color: token.colorText }}>
          <Link to="/" style={{ color: 'inherit' }}>
            ⚡ {t('app.name')}
          </Link>
        </div>

        {isMobile ? (
          <Button
            type="text"
            aria-label="menu"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={() => setDrawerOpen(true)}
            style={{ color: token.colorText }}
          />
        ) : (
          <>
            <Menu
              theme="light"
              mode="horizontal"
              selectedKeys={[location.pathname]}
              items={navItems}
              style={{ background: 'transparent', flex: 1, borderBottom: 'none' }}
            />
            <LanguageSwitcher />
            {user ? (
              <div className="flex items-center gap-3 ml-3">
                <Dropdown menu={userMenu}>
                  <div className="flex items-center gap-2 cursor-pointer" style={{ color: token.colorText }}>
                    <Avatar icon={<UserOutlined />} />
                    <span>{user.name || user.email}</span>
                  </div>
                </Dropdown>
              </div>
            ) : (
              <div className="flex gap-2 ml-3">
                <Button onClick={() => navigate('/login')}>{t('nav.login')}</Button>
                <Button type="primary" onClick={() => navigate('/register')}>{t('nav.register')}</Button>
              </div>
            )}
          </>
        )}
      </Header>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        placement="right"
        width={280}
        styles={{ body: { padding: 0 } }}
        title={<LanguageSwitcher />}
      >
        {user && (
          <div className="flex items-center gap-2 px-4 py-3" style={{ color: token.colorText }}>
            <Avatar icon={<UserOutlined />} />
            <span className="truncate">{user.name || user.email}</span>
          </div>
        )}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={navItems}
          style={{ borderInlineEnd: 'none' }}
          onClick={closeDrawer}
        />
        <div className="flex flex-col gap-2 p-4">
          {user ? (
            <>
              <Button block onClick={() => go('/builder/profile')}>{t('nav.builderProfile')}</Button>
              <Button block onClick={() => go('/wallet')}>{t('nav.wallet')}</Button>
              <Button block onClick={() => go('/change-password')}>{t('nav.changePassword')}</Button>
              <Button block danger onClick={() => { logout(); go('/'); }}>{t('nav.logout')}</Button>
            </>
          ) : (
            <>
              <Button block onClick={() => go('/login')}>{t('nav.login')}</Button>
              <Button block type="primary" onClick={() => go('/register')}>{t('nav.register')}</Button>
            </>
          )}
        </div>
      </Drawer>

      <Content className="p-4 md:p-6" style={{ backgroundColor: token.colorBgBase }}>
        <Outlet />
      </Content>
      <Footer className="text-center text-gray-500">
        {t('app.footer', { year: new Date().getFullYear() })}
      </Footer>
      <FeedbackWidget />
    </Layout>
  );
}
