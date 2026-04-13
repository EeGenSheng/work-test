"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppstoreOutlined, FileTextOutlined, SettingOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Card, ConfigProvider, Layout, Menu, Progress, Space, Statistic, Tag, Typography } from 'antd';

const overviewStats = [
  { label: 'Active participants', value: '128', change: '+12 this month', tone: 'emerald' },
  { label: 'Providers', value: '34', change: '4 pending review', tone: 'blue' },
  { label: 'Open invoices', value: '19', change: '6 due this week', tone: 'amber' },
  { label: 'Rate sets', value: '9', change: 'Last updated 2 days ago', tone: 'slate' },
];

const recentItems = [
  'Provider onboarding completed for two new services.',
  'Invoice batch synced to the accounting queue.',
  'Rate set approved for the current billing cycle.',
  'Participant support notes updated for priority cases.',
];

const quickLinks = [
  { label: 'Create participant record', href: '/participants' },
  { label: 'Review provider list', href: '/provider' },
  { label: 'Process invoice batch', href: '/invoice' },
  { label: 'Adjust rate set', href: '/rate-set' },
];

type DashboardShellProps = {
  activeKey?: string;
  title: string;
  children?: ReactNode;
};

const navigationItems = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: AppstoreOutlined },
  { key: 'participants', label: 'Participants', href: '/participants', icon: UserOutlined },
  { key: 'provider', label: 'Provider', href: '/provider', icon: TeamOutlined },
  { key: 'invoice', label: 'Invoice', href: '/invoice', icon: FileTextOutlined },
  { key: 'rate-set', label: 'Rate Set', href: '/rate-set', icon: SettingOutlined },
];

function getActiveKey(pathname: string) {
  if (pathname === '/') {
    return 'dashboard';
  }

  const matched = navigationItems.find((item) => item.href === pathname);
  return matched?.key ?? 'dashboard';
}

export function DashboardShell({ activeKey, title, children }: DashboardShellProps) {
  const pathname = usePathname();
  const selectedKey = activeKey ?? getActiveKey(pathname);

  return (
    <ConfigProvider>
      <Layout className="min-h-screen bg-transparent">
        <Layout.Sider
          breakpoint="lg"
          collapsedWidth={0}
          width={280}
          className="!min-h-screen !border-r !border-slate-200/70 !bg-white/85 !px-4 !py-6 !backdrop-blur"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
        >
          <div className="mb-6 rounded-3xl border border-slate-200/80 bg-slate-50 px-4 py-5 text-slate-900 shadow-sm">
            <Space align="center" size={12}>
              <Avatar size={44} className="bg-emerald-600 font-semibold">
                N
              </Avatar>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Dashboard</div>
                <div className="text-xl font-semibold">NDIS</div>
              </div>
            </Space>
          </div>

          <Menu
            mode="inline"
            theme="light"
            selectedKeys={[selectedKey]}
            style={{ background: 'transparent', borderInlineEnd: 0 }}
            className="!border-0 !bg-transparent !text-slate-700"
            items={navigationItems.map((item) => {
              const Icon = item.icon;

              return {
                key: item.key,
                icon: <Icon />,
                label: <Link href={item.href}>{item.label}</Link>,
              };
            })}
          />
        </Layout.Sider>

        <Layout className="flex min-h-screen flex-col bg-transparent">
          <Layout.Header className="!flex !h-auto !items-center !justify-between !border-b !border-slate-200/70 !bg-white/70 !px-6 !py-5 !backdrop-blur">
            <div>
              <Typography.Text className="block text-xs uppercase tracking-[0.3em] text-slate-500">NDIS</Typography.Text>
              <Typography.Title level={2} className="!m-0 !text-3xl !text-slate-900">
                {title}
              </Typography.Title>
            </div>
          </Layout.Header>

          <Layout.Content className="flex-1 bg-transparent p-6 lg:p-8">
            {children ?? (
              <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {overviewStats.map((item) => (
                    <Card key={item.label} className="border-slate-200/80 shadow-sm">
                      <Space direction="vertical" size={10} className="w-full">
                        <div className="flex items-center justify-between">
                          <Typography.Text className="text-sm font-medium text-slate-500">{item.label}</Typography.Text>
                          <Tag color={item.tone === 'emerald' ? 'green' : item.tone === 'blue' ? 'blue' : item.tone === 'amber' ? 'gold' : 'default'}>
                            Live
                          </Tag>
                        </div>
                        <Statistic value={item.value} valueStyle={{ color: '#0f172a', fontSize: 28, lineHeight: 1.1 }} />
                        <Typography.Text className="text-sm text-slate-500">{item.change}</Typography.Text>
                      </Space>
                    </Card>
                  ))}
                </div>

                <div className="grid flex-1 gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                  <Card className="h-full border-slate-200/80 shadow-glow">
                    <Space direction="vertical" size={18} className="w-full">
                      <div>
                        <Typography.Title level={3} className="!m-0 !text-slate-900">
                          Welcome to the NDIS dashboard
                        </Typography.Title>
                        <Typography.Paragraph className="!mb-0 !mt-2 !text-slate-600">
                          Use the sidebar to move between Participants, Provider, Invoice, and Rate Set pages. This overview
                          keeps the page filled with useful operational context.
                        </Typography.Paragraph>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {navigationItems
                          .filter((item) => item.key !== 'dashboard')
                          .map((item) => {
                            const Icon = item.icon;

                            return (
                              <Link
                                key={item.key}
                                href={item.href}
                                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                              >
                                <span className="font-medium">{item.label}</span>
                                <Icon />
                              </Link>
                            );
                          })}
                      </div>
                    </Space>
                  </Card>

                  <Space direction="vertical" size={6} className="h-full w-full">
                    <Card className="h-full border-slate-200/80 shadow-sm" title="Operational status">
                      <Space direction="vertical" size={16} className="w-full">
                        <div>
                          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                            <span>Queue health</span>
                            <span>82%</span>
                          </div>
                          <Progress percent={82} strokeColor="#0f766e" trailColor="#e2e8f0" />
                        </div>

                        <div className="space-y-3">
                          {recentItems.map((item) => (
                            <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                              {item}
                            </div>
                          ))}
                        </div>
                      </Space>
                    </Card>

                    <Card className="border-slate-200/80 shadow-sm" title="Quick actions">
                      <div className="space-y-3">
                        {quickLinks.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-slate-700 transition hover:bg-slate-100"
                          >
                            <span>{item.label}</span>
                            <AppstoreOutlined />
                          </Link>
                        ))}
                      </div>
                    </Card>
                  </Space>
                </div>
              </div>
            )}
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}