import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  UserOutlined, RiseOutlined, StopOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../api/adminClient';

const { Title } = Typography;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    adminApi.get('/stats/overview').then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  if (!stats) return <div>加载失败</div>;

  return (
    <div>
      <Title level={3}>数据概览</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="总用户数" value={stats.users.total} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="7 日新增" value={stats.users.newLast7d}
              prefix={<RiseOutlined />} valueStyle={{ color: '#2563eb' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="30 日新增" value={stats.users.newLast30d}
              prefix={<RiseOutlined />} valueStyle={{ color: '#059669' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已停用" value={stats.users.suspended}
              prefix={<StopOutlined />} valueStyle={{ color: '#d97706' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="用户状态分布">
            <Row gutter={16}>
              <Col span={8}><Statistic title="活跃" value={stats.users.active}
                valueStyle={{ color: '#059669' }} /></Col>
              <Col span={8}><Statistic title="已停用" value={stats.users.suspended}
                valueStyle={{ color: '#d97706' }} /></Col>
              <Col span={8}><Statistic title="已删除" value={stats.users.deleted}
                valueStyle={{ color: '#6b7280' }} /></Col>
            </Row>
          </Card>
        </Col>
        {/* Marketplace 统计卡(GMV / 待审核 / 纠纷)在 Phase 8 接入 */}
      </Row>
    </div>
  );
}
