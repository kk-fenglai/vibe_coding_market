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

  // BuilderHub 顶栏四项：Market / Projects / Messages / Wallet（未登录点击会被
  // RequireAuth 重定向到登录页；「我的投标」入口在用户下拉菜单里）
  const navLinks = [
    { key: '/projects', label: t('nav.marketplace') },
    { key: '/my/projects', label: t('nav.myProjects') },
    { key: '/messages', label: t('nav.messages'), badge: unread },
    { key: '/wallet', label: t('nav.wallet') },
  ];

  const navItems = [
    ...navLinks.map((item) => ({
      key: item.key,
      label: (
        <Link to={item.key}>
          {item.badge ? (
            <Badge count={item.badge} size="small" offset={[8, -2]}>{item.label}</Badge>
          ) : item.label}
        </Link>
      ),
    })),
    { key: '/projects/new', label: <Link to="/projects/new">{t('nav.postProject')}</Link> },
  ];

  const userMenu = {
    items: [
      { key: 'builderProfile', label: t('nav.builderProfile'), onClick: () => navigate('/builder/profile') },
      { key: 'myApplications', label: t('nav.myApplications'), onClick: () => navigate('/my/applications') },
      { key: 'changePassword', label: t('nav.changePassword'), onClick: () => navigate('/change-password') },
      { key: 'logout', label: t('nav.logout'), onClick: () => { logout(); navigate('/'); } },
    ],
  };

  return (
    <Layout className="min-h-screen" style={{ background: token.colorBgBase }}>
      <Header
        className="flex items-center px-4 md:px-8"
        style={{
          background: '#faf9f7',
          height: 80,
          lineHeight: 'normal',
          boxShadow: '0 1px 2px rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.04)',
        }}
      >
        <div className="font-black text-2xl tracking-tight flex-1 md:flex-none truncate text-hub-logo">
          <Link to="/" style={{ color: 'inherit' }}>
            {t('app.name')}
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
            <nav className="flex items-center gap-6 ml-12 flex-1 self-stretch">
              {navLinks.map((item) => {
                const active = item.key === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.key);
                return (
                  <Link
                    key={item.key}
                    to={item.key}
                    className={`flex items-center self-stretch px-3 text-base rounded-full my-auto py-1.5 whitespace-nowrap transition-colors ${
                      active
                        ? 'font-bold text-hub-logo bg-[rgba(255,107,0,0.08)]'
                        : 'text-hub-body hover:text-hub-logo hover:bg-[#f1f0ed]'
                    }`}
                  >
                    {item.badge ? (
                      <Badge count={item.badge} size="small" offset={[8, -2]}>{item.label}</Badge>
                    ) : item.label}
                  </Link>
                );
              })}
            </nav>
            <Button type="primary" className="mr-3 font-medium" onClick={() => navigate('/projects/new')}>
              {t('nav.postProject')}
            </Button>
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
              <Button block onClick={() => go('/my/applications')}>{t('nav.myApplications')}</Button>
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
      <Footer style={{ background: '#213145', padding: '48px 32px' }}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <span className="font-black text-2xl tracking-tight" style={{ color: '#ffdbcc' }}>
              {t('app.name')}
            </span>
            <span className="text-base" style={{ color: '#d3e4fe' }}>
              {t('app.footer', { year: new Date().getFullYear() })}
            </span>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center text-base" style={{ color: '#d3e4fe' }}>
            <Link to="/" style={{ color: 'inherit' }}>{t('nav.home')}</Link>
            <Link to="/projects" style={{ color: 'inherit' }}>{t('nav.marketplace')}</Link>
            <Link to="/projects/new" style={{ color: 'inherit' }}>{t('nav.postProject')}</Link>
          </div>
        </div>
      </Footer>
      <FeedbackWidget />
    </Layout>
  );
}
