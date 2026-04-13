"use client";

import { useEffect, useMemo, useState } from 'react';

import dayjs, { type Dayjs } from 'dayjs';
import { Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { DashboardShell } from '@/components/dashboard-shell';

type InvoiceStatus = 'drafted' | 'completed';

type InvoiceItemFormValues = {
  id?: number;
  rate_set_id?: number;
  category_id?: number;
  support_item_id?: number;
  start_date?: Dayjs;
  end_date?: Dayjs;
  max_rate?: number | null;
  unit?: number | null;
  input_rate?: number | null;
};

type InvoiceFormValues = {
  client_id: number;
  provider_id: number;
  invoice_number: string;
  invoice_date: Dayjs;
  expected_amount: number;
  items: InvoiceItemFormValues[];
};

type InvoiceItemRecord = {
  id: number;
  invoice_id: number;
  rate_set_id: number | null;
  category_id: number | null;
  support_item_id: number | null;
  start_date: string | null;
  end_date: string | null;
  max_rate: string | null;
  unit: string | null;
  input_rate: string | null;
  amount: string | null;
};

type InvoiceRecord = {
  id: number;
  client_id: number;
  provider_id: number;
  invoice_number: string;
  invoice_date: string;
  amount: string;
  expected_amount: string;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_region: string | null;
  provider_name: string | null;
  provider_abn: string | null;
  item_count: number;
};

type InvoiceDetail = InvoiceRecord & {
  items: InvoiceItemRecord[];
};

type LookupClient = {
  id: number;
  name: string;
  pricing_region: string;
};

type LookupProvider = {
  id: number;
  name: string;
  abn: string;
};

type LookupCategory = {
  id: number;
  rate_set_id: number;
  name: string;
};

type LookupSupportItem = {
  id: number;
  rate_set_id: number;
  category_id: number;
  name: string;
};

type LookupRateSet = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
};

type LookupPrice = {
  rate_set_id: number;
  support_item_id: number;
  pricing_region: string;
  unit_price: string;
};

type LookupData = {
  clients: LookupClient[];
  providers: LookupProvider[];
  categories: LookupCategory[];
  supportItems: LookupSupportItem[];
  rateSets: LookupRateSet[];
  prices: LookupPrice[];
};

type InvoiceListResponse = {
  invoices?: InvoiceRecord[];
  lookups?: LookupData;
  error?: string;
};

type InvoiceDetailResponse = {
  invoice?: InvoiceDetail;
  lookups?: LookupData;
  error?: string;
};

type InvoiceSaveResponse = {
  id?: number;
  status?: InvoiceStatus;
  amount?: number;
  error?: string;
  details?: Record<string, string>;
};

function hasInvoiceItemValue(value: number | Dayjs | null | undefined) {
  return value !== undefined && value !== null;
}

const blankItem = (): InvoiceItemFormValues => ({
  max_rate: null,
});

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: string | number | null | undefined) {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  return numericValue.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toInvoiceDate(value: Dayjs | undefined) {
  return value ? value.format('YYYY-MM-DD') : undefined;
}

function toNullableNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toFormDate(value: string | null | undefined) {
  return value ? dayjs(value) : undefined;
}

function toFormNumber(value: string | null | undefined) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toFormId(value: string | number | null | undefined) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function normalizePricingRegion(value: string | null | undefined) {
  return (value || '').trim().replaceAll(' ', '_').toUpperCase();
}

export default function InvoicePage() {
  const [form] = Form.useForm<InvoiceFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [lookups, setLookups] = useState<LookupData>({ clients: [], providers: [], categories: [], supportItems: [], rateSets: [], prices: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const clientById = useMemo(() => new Map(lookups.clients.map((client) => [client.id, client])), [lookups.clients]);
  const providerById = useMemo(() => new Map(lookups.providers.map((provider) => [provider.id, provider])), [lookups.providers]);
  const categoryById = useMemo(() => new Map(lookups.categories.map((category) => [category.id, category])), [lookups.categories]);
  const supportItemById = useMemo(() => new Map(lookups.supportItems.map((item) => [item.id, item])), [lookups.supportItems]);
  const rateSetById = useMemo(() => new Map(lookups.rateSets.map((rateSet) => [rateSet.id, rateSet])), [lookups.rateSets]);
  const priceLookup = useMemo(() => {
    const map = new Map<string, LookupPrice>();

    for (const price of lookups.prices) {
      map.set(`${price.rate_set_id}:${price.support_item_id}:${price.pricing_region}`, price);
    }

    return map;
  }, [lookups.prices]);

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return invoices;
    }

    return invoices.filter((invoice) => {
      return (
        invoice.invoice_number.toLowerCase().includes(normalizedQuery) ||
        (invoice.client_name ?? '').toLowerCase().includes(normalizedQuery) ||
        (invoice.provider_name ?? '').toLowerCase().includes(normalizedQuery) ||
        invoice.status.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [invoices, searchQuery]);

  const clientOptions = useMemo(
    () => lookups.clients.map((client) => ({ value: client.id, label: client.name })),
    [lookups.clients],
  );

  const providerOptions = useMemo(
    () => lookups.providers.map((provider) => ({ value: provider.id, label: `${provider.id} - ${provider.name} (${provider.abn})` })),
    [lookups.providers],
  );

  const categoryOptions = useMemo(
    () =>
      [...lookups.categories]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map((category) => ({ value: category.id, label: `${category.id} - ${category.name}` })),
    [lookups.categories],
  );

  const supportItemOptions = useMemo(
    () =>
      [...lookups.supportItems]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map((item) => ({ value: item.id, label: `${item.id} - ${item.name}` })),
    [lookups.supportItems],
  );

  const rateSetOptions = useMemo(
    () =>
      [...lookups.rateSets]
        .sort((a, b) => {
          const startDiff = dayjs(a.start_date).valueOf() - dayjs(b.start_date).valueOf();
          if (startDiff !== 0) {
            return startDiff;
          }

          return a.id - b.id;
        })
        .map((rateSet) => ({
          value: rateSet.id,
          label: `${rateSet.name} (#${rateSet.id}) (${rateSet.start_date} to ${rateSet.end_date ?? 'open'})`,
        })),
    [lookups.rateSets],
  );

  const loadInvoices = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/invoice', { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as InvoiceListResponse;

      if (!response.ok) {
        throw new Error(result.error || 'Unable to load invoices.');
      }

      setInvoices(result.invoices || []);
      if (result.lookups) {
        setLookups(result.lookups);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load invoices.';
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, []);

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingInvoiceId(null);
    form.resetFields();
  };

  const openNewInvoiceModal = () => {
    setEditingInvoiceId(null);
    form.setFieldsValue({
      items: [blankItem()],
    } as Partial<InvoiceFormValues>);
    setIsModalOpen(true);
  };

  const openEditInvoiceModal = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoice?id=${invoiceId}`, { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as InvoiceDetailResponse;

      if (!response.ok || !result.invoice) {
        throw new Error(result.error || 'Unable to load invoice details.');
      }

      const invoice = result.invoice;
      if (result.lookups) {
        setLookups(result.lookups);
      }

      setEditingInvoiceId(invoice.id);
      form.setFieldsValue({
        client_id: toFormId(invoice.client_id),
        provider_id: toFormId(invoice.provider_id),
        invoice_number: invoice.invoice_number,
        invoice_date: toFormDate(invoice.invoice_date),
        expected_amount: toFormNumber(invoice.expected_amount),
        items: invoice.items.map((item) => ({
          id: toFormId(item.id),
          rate_set_id: toFormId(item.rate_set_id),
          category_id: toFormId(item.category_id),
          support_item_id: toFormId(item.support_item_id),
          start_date: toFormDate(item.start_date),
          end_date: toFormDate(item.end_date),
          max_rate: toFormNumber(item.max_rate),
          unit: toFormNumber(item.unit),
          input_rate: toFormNumber(item.input_rate),
        })),
      });

      setIsModalOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load invoice details.';
      message.error(errorMessage);
    }
  };

  const openInvoiceDetail = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoice?id=${invoiceId}`, { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as InvoiceDetailResponse;

      if (!response.ok || !result.invoice) {
        throw new Error(result.error || 'Unable to load invoice details.');
      }

      setDetailInvoice(result.invoice);
      if (result.lookups) {
        setLookups(result.lookups);
      }
      setIsDetailOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load invoice details.';
      message.error(errorMessage);
    }
  };

  const normalizeItems = (items: InvoiceItemFormValues[] | undefined) => {
    return (items || [])
      .filter((item) => {
        return [
          item.rate_set_id,
          item.category_id,
          item.support_item_id,
          item.start_date,
          item.end_date,
          item.max_rate,
          item.unit,
          item.input_rate,
        ].some((value) => hasInvoiceItemValue(value as number | Dayjs | null | undefined));
      })
      .map((item) => ({
        id: item.id,
        rate_set_id: item.rate_set_id,
        category_id: item.category_id,
        support_item_id: item.support_item_id,
        start_date: toInvoiceDate(item.start_date),
        end_date: toInvoiceDate(item.end_date),
        max_rate: toNullableNumber(item.max_rate),
        unit: toNullableNumber(item.unit),
        input_rate: toNullableNumber(item.input_rate),
      }));
  };

  const saveInvoice = async (status: InvoiceStatus) => {
    let values: InvoiceFormValues;

    if (status === 'completed') {
      values = await form.validateFields();
    } else {
      values = form.getFieldsValue(true) as InvoiceFormValues;
    }

    const payload = {
      status,
      client_id: values.client_id,
      provider_id: values.provider_id,
      invoice_number: values.invoice_number?.trim(),
      invoice_date: toInvoiceDate(values.invoice_date),
      expected_amount: values.expected_amount,
      items: normalizeItems(values.items),
    };

    setIsSubmitting(true);

    try {
      const endpoint = editingInvoiceId ? `/api/invoice?id=${editingInvoiceId}` : '/api/invoice';
      const response = await fetch(endpoint, {
        method: editingInvoiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as InvoiceSaveResponse;

      if (!response.ok) {
        if (result.details) {
          const fields: Parameters<typeof form.setFields>[0] = [];

          for (const [name, errorMessage] of Object.entries(result.details)) {
            if (name.startsWith('items.')) {
              const parts = name.split('.');
              const index = Number(parts[1]);
              const fieldName = parts[2];

              if (Number.isInteger(index) && fieldName) {
                fields.push({
                  name: ['items', index, fieldName as keyof InvoiceItemFormValues],
                  errors: [errorMessage],
                });
              }
            } else {
              fields.push({
                name: name as keyof InvoiceFormValues,
                errors: [errorMessage],
              });
            }
          }

          form.setFields(fields);
        }

        throw new Error(result.error || 'Unable to save invoice.');
      }

      message.success(status === 'completed' ? 'Invoice saved successfully.' : 'Invoice draft saved.');
      await loadInvoices();
      resetModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save invoice.';
      message.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteInvoice = async (invoiceId: number) => {
    setDeletingInvoiceId(invoiceId);

    try {
      const response = await fetch(`/api/invoice?id=${invoiceId}`, { method: 'DELETE' });
      const result = (await response.json()) as InvoiceSaveResponse;

      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete invoice.');
      }

      message.success('Invoice deleted.');
      await loadInvoices();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to delete invoice.';
      message.error(errorMessage);
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const invoiceColumns = useMemo<ColumnsType<InvoiceRecord>>(
    () => [
      {
        title: 'Invoice #',
        dataIndex: 'invoice_number',
        key: 'invoice_number',
      },
      {
        title: 'Client',
        dataIndex: 'client_name',
        key: 'client_name',
        render: (value: string | null, record: InvoiceRecord) => value || clientById.get(record.client_id)?.name || `Client ${record.client_id}`,
      },
      {
        title: 'Provider',
        dataIndex: 'provider_name',
        key: 'provider_name',
        render: (value: string | null, record: InvoiceRecord) => value || providerById.get(record.provider_id)?.name || `Provider ${record.provider_id}`,
      },
      {
        title: 'Invoice Date',
        dataIndex: 'invoice_date',
        key: 'invoice_date',
      },
      {
        title: 'Expected Amount',
        dataIndex: 'expected_amount',
        key: 'expected_amount',
        render: (value: string) => formatMoney(value),
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        key: 'amount',
        render: (value: string) => formatMoney(value),
      },
      {
        title: 'Items',
        dataIndex: 'item_count',
        key: 'item_count',
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (value: InvoiceStatus) => <Tag color={value === 'completed' ? 'green' : 'gold'}>{value}</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 220,
        render: (_: unknown, record: InvoiceRecord) => (
          <Space size={8}>
            <Button size="small" onClick={() => void openInvoiceDetail(record.id)}>
              View
            </Button>
            <Button size="small" onClick={() => void openEditInvoiceModal(record.id)}>
              Edit
            </Button>
            <Popconfirm
              title="Delete invoice"
              description="This will soft delete the invoice and its items."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingInvoiceId === record.id }}
              cancelText="Cancel"
              onConfirm={() => void deleteInvoice(record.id)}
            >
              <Button danger size="small" loading={deletingInvoiceId === record.id}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [clientById, deletingInvoiceId, providerById],
  );

  const detailItemsColumns: ColumnsType<InvoiceItemRecord> = [
    {
      title: 'Rate Set',
      dataIndex: 'rate_set_id',
      key: 'rate_set_id',
      render: (value: number | null) => (value ? rateSetById.get(value)?.name ?? `#${value}` : '-'),
    },
    {
      title: 'Category',
      dataIndex: 'category_id',
      key: 'category_id',
      render: (value: number | null) => (value ? categoryById.get(value)?.name ?? `#${value}` : '-'),
    },
    {
      title: 'Support Item',
      dataIndex: 'support_item_id',
      key: 'support_item_id',
      render: (value: number | null) => (value ? supportItemById.get(value)?.name ?? `#${value}` : '-'),
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Max Rate',
      dataIndex: 'max_rate',
      key: 'max_rate',
      render: (value: string | null) => formatMoney(value),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      render: (value: string | null) => formatMoney(value),
    },
    {
      title: 'Input Rate',
      dataIndex: 'input_rate',
      key: 'input_rate',
      render: (value: string | null) => formatMoney(value),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: string | null) => formatMoney(value),
    },
  ];

  return (
    <DashboardShell title="Invoice">
      <div className="mx-auto w-full max-w-7xl">
        <Card className="border-slate-200/80 shadow-sm">
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={16} xl={12}>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Invoice # / Client / Provider / Status"
                allowClear
              />
            </Col>
            <Col xs={24} md={8} xl={12} className="flex justify-end">
              <Button type="primary" size="large" onClick={openNewInvoiceModal}>
                Add Invoice
              </Button>
            </Col>
          </Row>

          <div className="mt-4 text-sm text-slate-500">Use the sidebar to open Participants and Provider pages.</div>
        </Card>

        <Card className="mt-6 border-slate-200/80 shadow-sm" title="Invoices List">
          <Table<InvoiceRecord>
            rowKey="id"
            columns={invoiceColumns}
            dataSource={filteredInvoices}
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1400 }}
          />
        </Card>
      </div>

      <Modal
        title={editingInvoiceId ? 'Edit Invoice' : 'Add Invoice'}
        open={isModalOpen}
        onCancel={resetModal}
        footer={
          <Space>
            <Button onClick={resetModal}>Cancel</Button>
            <Button loading={isSubmitting} onClick={() => void saveInvoice('drafted')}>
              Save as Draft
            </Button>
            <Button type="primary" loading={isSubmitting} onClick={() => void saveInvoice('completed')}>
              Save
            </Button>
          </Space>
        }
        width={1200}
        destroyOnClose
      >
        <Form<InvoiceFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ items: [blankItem()] }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Client" name="client_id" rules={[{ required: true, message: 'client_id is required.' }]}>
                <Select placeholder="Select client" options={clientOptions} showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Provider" name="provider_id" rules={[{ required: true, message: 'provider_id is required.' }]}>
                <Select placeholder="Select provider" options={providerOptions} showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item
                label="Invoice number"
                name="invoice_number"
                rules={[{ required: true, message: 'invoice_number is required.' }]}
              >
                <Input placeholder="Invoice number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Invoice date" name="invoice_date" rules={[{ required: true, message: 'invoice_date is required.' }]}>
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                label="Expected amount"
                name="expected_amount"
                rules={[{ required: true, message: 'expected_amount is required.' }]}
              >
                <InputNumber className="w-full" min={0} precision={2} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="Amount" shouldUpdate>
                {() => {
                  const itemValues = form.getFieldValue('items') as InvoiceItemFormValues[] | undefined;
                  const previewAmount = round2(
                    (itemValues || []).reduce((sum, item) => {
                      const unit = typeof item?.unit === 'number' ? item.unit : Number(item?.unit ?? 0);
                      const inputRate = typeof item?.input_rate === 'number' ? item.input_rate : Number(item?.input_rate ?? 0);
                      const itemAmount = Number.isFinite(unit) && Number.isFinite(inputRate) ? round2(unit * inputRate) : 0;
                      return sum + itemAmount;
                    }, 0),
                  );

                  return <InputNumber className="w-full" value={previewAmount} precision={2} disabled />;
                }}
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space direction="vertical" className="w-full" size={16}>
                <div className="flex items-center justify-between">
                  <Typography.Title level={4} className="!m-0">
                    Invoice Items
                  </Typography.Title>
                  <Button onClick={() => add(blankItem())}>Add Item</Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.key} size="small" className="border-slate-200/70">
                    <div className="mb-4 flex items-center justify-between">
                      <Typography.Text className="font-medium text-slate-700">Item {index + 1}</Typography.Text>
                      <Button danger size="small" onClick={() => remove(field.name)}>
                        Remove
                      </Button>
                    </div>

                    <Form.Item noStyle shouldUpdate>
                      {() => {
                      const itemValues = form.getFieldValue(['items', field.name]) as InvoiceItemFormValues | undefined;
                      const selectedClientId = form.getFieldValue('client_id') as number | undefined;
                      const selectedClient = selectedClientId ? clientById.get(selectedClientId) : undefined;

                      const selectedRateSetId = itemValues?.rate_set_id;
                      const selectedCategoryId = itemValues?.category_id;
                      const selectedSupportItemId = itemValues?.support_item_id;
                      const selectedStartDate = itemValues?.start_date;
                      const selectedEndDate = itemValues?.end_date;

                      const filteredCategories = selectedRateSetId
                        ? categoryOptions.filter((option) => {
                            const category = categoryById.get(option.value);
                            return category?.rate_set_id === selectedRateSetId;
                          })
                        : categoryOptions;

                      const filteredSupportItems = supportItemOptions.filter((option) => {
                        const supportItem = supportItemById.get(option.value);
                        if (!supportItem) {
                          return false;
                        }

                        if (!selectedCategoryId) {
                          return false;
                        }

                        if (selectedRateSetId && supportItem.rate_set_id !== selectedRateSetId) {
                          return false;
                        }

                        if (selectedCategoryId && supportItem.category_id !== selectedCategoryId) {
                          return false;
                        }

                        return true;
                      });

                      const normalizedRegion = normalizePricingRegion(selectedClient?.pricing_region);
                      const canDeriveMaxRate =
                        isPositiveInteger(selectedRateSetId) &&
                        isPositiveInteger(selectedSupportItemId) &&
                        selectedStartDate &&
                        selectedEndDate &&
                        Boolean(normalizedRegion);

                      let derivedMaxRate: number | null = null;

                      if (canDeriveMaxRate) {
                        const key = `${selectedRateSetId}:${selectedSupportItemId}:${normalizedRegion}`;
                        const lookupPrice = priceLookup.get(key);
                        const parsed = Number(lookupPrice?.unit_price ?? '');
                        if (Number.isFinite(parsed)) {
                          derivedMaxRate = round2(parsed);
                        }
                      }

                        return (
                        <>
                          <Row gutter={16}>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Rate set" name={[field.name, 'rate_set_id']}>
                                <Select
                                  placeholder="Select rate set"
                                  options={rateSetOptions}
                                  showSearch
                                  optionFilterProp="label"
                                  onChange={() => {
                                    form.setFieldValue(['items', field.name, 'category_id'], undefined);
                                    form.setFieldValue(['items', field.name, 'support_item_id'], undefined);
                                  }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Category" name={[field.name, 'category_id']}>
                                <Select
                                  placeholder="Select category"
                                  options={filteredCategories}
                                  showSearch
                                  optionFilterProp="label"
                                  onChange={() => {
                                    form.setFieldValue(['items', field.name, 'support_item_id'], undefined);
                                  }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Support item" name={[field.name, 'support_item_id']}>
                                <Select
                                  placeholder={selectedCategoryId ? 'Select support item' : 'Select category first'}
                                  options={filteredSupportItems}
                                  showSearch
                                  optionFilterProp="label"
                                  disabled={!selectedCategoryId}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Max rate" name={[field.name, 'max_rate']}>
                                <InputNumber className="w-full" precision={2} placeholder={derivedMaxRate !== null ? `${derivedMaxRate.toFixed(2)} (derived)` : 'Derived on save'} disabled />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={16}>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Start date" name={[field.name, 'start_date']}>
                                <DatePicker className="w-full" format="YYYY-MM-DD" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="End date" name={[field.name, 'end_date']}>
                                <DatePicker className="w-full" format="YYYY-MM-DD" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Unit" name={[field.name, 'unit']}>
                                <InputNumber className="w-full" min={0} precision={2} placeholder="0.00" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} xl={6}>
                              <Form.Item label="Input rate" name={[field.name, 'input_rate']}>
                                <InputNumber className="w-full" min={0} precision={2} placeholder="0.00" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </>
                        );
                      }}
                    </Form.Item>
                  </Card>
                ))}
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Drawer
        title={detailInvoice ? `Invoice ${detailInvoice.invoice_number}` : 'Invoice Details'}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailInvoice(null);
        }}
        width={1100}
      >
        {detailInvoice ? (
          <Space direction="vertical" className="w-full" size={16}>
            <Card className="border-slate-200/80">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Client</div>
                  <div className="mt-1 inline-block font-medium text-slate-900">
                    {detailInvoice.client_name ?? clientById.get(detailInvoice.client_id)?.name ?? `Client ${detailInvoice.client_id}`}
                  </div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Provider</div>
                  <div className="mt-1 inline-block font-medium text-slate-900">
                    {detailInvoice.provider_name ?? providerById.get(detailInvoice.provider_id)?.name ?? `Provider ${detailInvoice.provider_id}`}
                  </div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Invoice Date</div>
                  <div className="mt-1 font-medium text-slate-900">{detailInvoice.invoice_date}</div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</div>
                  <div className="mt-1">
                    <Tag color={detailInvoice.status === 'completed' ? 'green' : 'gold'}>{detailInvoice.status}</Tag>
                  </div>
                </Col>
              </Row>

              <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(detailInvoice.amount)}</div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Expected Amount</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(detailInvoice.expected_amount)}</div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Invoice Number</div>
                  <div className="mt-1 font-medium text-slate-900">{detailInvoice.invoice_number}</div>
                </Col>
                <Col xs={24} md={12} xl={6}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Items</div>
                  <div className="mt-1 font-medium text-slate-900">{detailInvoice.item_count}</div>
                </Col>
              </Row>
            </Card>

            <Card className="border-slate-200/80" title="Invoice Items">
              <Table<InvoiceItemRecord>
                rowKey="id"
                columns={detailItemsColumns}
                dataSource={detailInvoice.items}
                pagination={false}
                scroll={{ x: 1200 }}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </DashboardShell>
  );
}