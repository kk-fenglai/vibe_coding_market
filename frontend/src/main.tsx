import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { StyleProvider } from '@ant-design/cssinjs';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { useTranslation } from 'react-i18next';
import App from './App';
import { apiOrigin } from './api/baseUrl';
import './i18n';
import './styles/index.css';

const apiOriginUrl = apiOrigin();
if (apiOriginUrl) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = apiOriginUrl;
  document.head.appendChild(link);
}

const antdLocaleMap = { zh: zhCN, en: enUS, fr: frFR };

function AppWithLocale() {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.split('-')[0] || 'zh') as keyof typeof antdLocaleMap;
  const locale = antdLocaleMap[lang] || zhCN;
  document.documentElement.lang = lang;

  return (
    <StyleProvider hashPriority="high">
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#ff6b00',
          // Admin login uses danger (red) buttons; default red was too light.
          colorError: '#dc2626',
          colorBgBase: '#faf9f7',
          colorBgContainer: '#ffffff',
          // Borderless look: surfaces separate via shadow/whitespace, not lines.
          // colorBorder stays visible only for checkbox/radio affordance.
          colorBorder: '#94a3b8',
          colorBorderSecondary: 'transparent',
          colorSplit: 'rgba(2, 6, 23, 0.04)',
          colorTextBase: '#0b1c30',
          colorTextSecondary: '#5a4136',
          colorLink: '#ff6b00',
          colorLinkHover: '#e66000',
          borderRadius: 16,
          fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
        },
        components: {
          // Make selection controls clearly visible: a deeper unchecked border
          // and a strong filled state when checked/selected.
          Checkbox: { colorBorder: '#64748b' },
          Radio: { colorBorder: '#64748b' },
          // Contra-style borderless pills: primary = solid orange, default =
          // soft neutral fill, no borders, no shadows.
          Button: {
            borderRadius: 999,
            borderRadiusLG: 999,
            borderRadiusSM: 999,
            fontWeight: 500,
            defaultBg: '#f1f0ed',
            defaultHoverBg: '#e9e7e2',
            defaultBorderColor: 'transparent',
            defaultHoverBorderColor: 'transparent',
            defaultShadow: 'none',
            primaryShadow: 'none',
            dangerShadow: 'none',
          },
          // Filled inputs: quiet gray fill, border only appears on focus.
          Input: {
            colorBorder: 'transparent',
            hoverBorderColor: '#d6d3cd',
            activeBorderColor: '#ff6b00',
            colorBgContainer: '#f1f0ed',
          },
          InputNumber: {
            colorBorder: 'transparent',
            hoverBorderColor: '#d6d3cd',
            activeBorderColor: '#ff6b00',
            colorBgContainer: '#f1f0ed',
          },
          Select: {
            colorBorder: 'transparent',
            colorBgContainer: '#f1f0ed',
          },
          Table: {
            borderColor: 'transparent',
            headerBg: 'transparent',
            headerSplitColor: 'transparent',
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
    </StyleProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithLocale />
  </React.StrictMode>
);
