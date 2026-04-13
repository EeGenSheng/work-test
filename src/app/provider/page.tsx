"use client";

import { useEffect, useMemo, useState } from 'react';

import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { DashboardShell } from '@/components/dashboard-shell';

type ProviderFormValues = {
  abn: string;
  name: string;
  email: string;
  phone_number?: string;
  address?: string;
  unit_building?: string;
};

type ProviderRecord = {
  id: number;
  abn: string;
  name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  unit_building: string | null;
  created_at: string;
};

const providerFieldNames: Array<keyof ProviderFormValues> = ['abn', 'name', 'email', 'phone_number', 'address', 'unit_building'];

const isProviderFieldName = (name: string): name is keyof ProviderFormValues => {
  return providerFieldNames.includes(name as keyof ProviderFormValues);
};

const requiredTrimmedRule = (fieldLabel: string) => ({
  validator: (_: unknown, value: string | undefined) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return Promise.reject(new Error(`${fieldLabel} is required.`));
    }

    return Promise.resolve();
  },
});

const providerTableColumns: ColumnsType<ProviderRecord> = [
  {
    title: 'ABN',
    dataIndex: 'abn',
    key: 'abn',
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Email',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: 'Phone',
    dataIndex: 'phone_number',
    key: 'phone_number',
    render: (value: string | null) => value || '-',
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
    render: (value: string | null) => value || '-',
  },
  {
    title: 'Unit / Building',
    dataIndex: 'unit_building',
    key: 'unit_building',
    render: (value: string | null) => value || '-',
  },
];

export default function ProviderPage() {
  const [form] = Form.useForm<ProviderFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<number | null>(null);
  const [deletingProviderId, setDeletingProviderId] = useState<number | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProviders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return providers.filter((provider) => {
      if (normalizedQuery.length === 0) {
        return true;
      }

      return (
        provider.abn.toLowerCase().includes(normalizedQuery) ||
        provider.name.toLowerCase().includes(normalizedQuery) ||
        provider.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [providers, searchQuery]);

  const loadProviders = async () => {
    setIsTableLoading(true);

    try {
      const response = await fetch('/api/provider', {
        method: 'GET',
        cache: 'no-store',
      });

      const result = (await response.json()) as {
        providers?: ProviderRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || 'Unable to load providers.');
      }

      setProviders(result.providers || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load providers.';
      message.error(errorMessage);
    } finally {
      setIsTableLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProviderId(null);
    form.resetFields();
  };

  const openAddProviderModal = () => {
    setEditingProviderId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditProviderModal = (provider: ProviderRecord) => {
    setEditingProviderId(provider.id);
    form.setFieldsValue({
      abn: provider.abn,
      name: provider.name,
      email: provider.email,
      phone_number: provider.phone_number || undefined,
      address: provider.address || undefined,
      unit_building: provider.unit_building || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    const payload = {
      abn: values.abn.trim(),
      name: values.name.trim(),
      email: values.email.trim(),
      phone_number: values.phone_number?.trim() || undefined,
      address: values.address?.trim() || undefined,
      unit_building: values.unit_building?.trim() || undefined,
    };

    setIsSubmitting(true);

    try {
      const isEditing = editingProviderId !== null;
      const endpoint = isEditing ? `/api/provider?id=${editingProviderId}` : '/api/provider';

      const response = await fetch(endpoint, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; details?: Record<string, string> };

      if (!response.ok) {
        if (result.details) {
          const fields: Parameters<typeof form.setFields>[0] = [];

          for (const [name, err] of Object.entries(result.details)) {
            if (isProviderFieldName(name)) {
              fields.push({
                name,
                errors: [err],
              });
            }
          }

          form.setFields(fields);
        }

        throw new Error(result.error || 'Unable to save provider.');
      }

      message.success(isEditing ? 'Provider updated successfully.' : 'Provider saved successfully.');
      await loadProviders();
      closeModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save provider.';
      message.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProvider = async (providerId: number) => {
    setDeletingProviderId(providerId);

    try {
      const response = await fetch(`/api/provider?id=${providerId}`, {
        method: 'DELETE',
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete provider.');
      }

      message.success('Provider deleted.');
      await loadProviders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to delete provider.';
      message.error(errorMessage);
    } finally {
      setDeletingProviderId(null);
    }
  };

  const tableColumns = useMemo<ColumnsType<ProviderRecord>>(
    () => [
      ...providerTableColumns,
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 200,
        render: (_: unknown, record: ProviderRecord) => (
          <div className="flex gap-2">
            <Button size="small" onClick={() => openEditProviderModal(record)}>
              Edit
            </Button>
            <Popconfirm
              title="Delete provider"
              description="This will hide the provider from active lists but keep historical records."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingProviderId === record.id }}
              cancelText="Cancel"
              onConfirm={() => handleDeleteProvider(record.id)}
            >
              <Button danger size="small" loading={deletingProviderId === record.id}>
                Delete
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [deletingProviderId],
  );

  return (
    <DashboardShell title="Provider">
      <div className="mx-auto w-full max-w-7xl">
        <Card className="border-slate-200/80 shadow-sm">
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={16} xl={12}>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ABN / Name / Email"
                allowClear
              />
            </Col>
            <Col xs={24} md={8} xl={12} className="flex justify-end">
              <Button type="primary" size="large" onClick={openAddProviderModal}>
                Add Provider
              </Button>
            </Col>
          </Row>
        </Card>

        <Card className="mt-6 border-slate-200/80 shadow-sm" title="Provider List">
          <Table<ProviderRecord>
            rowKey="id"
            columns={tableColumns}
            dataSource={filteredProviders}
            loading={isTableLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>
      </div>

      <Modal
        title={editingProviderId ? 'Edit Provider' : 'Add Provider'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={editingProviderId ? 'Update Provider' : 'Save Provider'}
        confirmLoading={isSubmitting}
        width={840}
        destroyOnClose
      >
        <Form<ProviderFormValues> form={form} layout="vertical" requiredMark={false}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="ABN"
                name="abn"
                rules={[
                  { required: true, message: 'ABN is required.' },
                  { pattern: /^\d{1,11}$/, message: 'ABN must be digits only and up to 11 digits.' },
                ]}
              >
                <Input placeholder="Digits only" maxLength={11} inputMode="numeric" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Name" name="name" rules={[requiredTrimmedRule('Name')]}>
                <Input placeholder="Enter provider name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Email is required.' },
                  { type: 'email', message: 'Enter a valid email address.' },
                ]}
              >
                <Input placeholder="name@example.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Phone number"
                name="phone_number"
                rules={[
                  {
                    validator: (_: unknown, value: string | undefined) => {
                      if (!value || value.length === 0) {
                        return Promise.resolve();
                      }

                      if (!/^\d{3,16}$/.test(value.trim())) {
                        return Promise.reject(new Error('Phone number must be digits only and 3-16 digits.'));
                      }

                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input placeholder="Optional" inputMode="numeric" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Address"
            name="address"
            rules={[
              {
                validator: (_: unknown, value: string | undefined) => {
                  if (value === undefined || value.length === 0) {
                    return Promise.resolve();
                  }

                  if (value.trim().length === 0) {
                    return Promise.reject(new Error('Address cannot be empty if provided.'));
                  }

                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>

          <Form.Item
            label="Unit / Building"
            name="unit_building"
            rules={[
              {
                validator: (_: unknown, value: string | undefined) => {
                  if (value === undefined || value.length === 0) {
                    return Promise.resolve();
                  }

                  if (value.trim().length === 0) {
                    return Promise.reject(new Error('Unit / Building cannot be empty if provided.'));
                  }

                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </DashboardShell>
  );
}