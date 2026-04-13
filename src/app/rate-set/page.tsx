"use client";

import { useEffect, useMemo, useState } from 'react';

import dayjs, { type Dayjs } from 'dayjs';
import { Button, Card, Col, DatePicker, Drawer, Form, Input, Modal, Popconfirm, Row, Space, Table, Tag, Typography, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd/es/upload';
import type { UploadFile } from 'antd/es/upload/interface';

import { DashboardShell } from '@/components/dashboard-shell';

type RateSetRow = {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
  category_count: number;
  support_item_count: number;
  price_count: number;
};

type RateSetCategoryRow = {
  id: number;
  rate_set_id: number;
  category_number: string;
  category_name: string;
  sorting: number;
};

type RateSetSupportItemRow = {
  id: number;
  rate_set_id: number;
  category_id: number;
  item_number: string;
  item_name: string;
  unit: string | null;
  sorting: number;
};

type RateSetSupportItemPriceRow = {
  id: number;
  rate_set_id: number;
  support_item_id: number;
  type_id: number | null;
  pricing_region_code: string | null;
  unit_price: string | null;
  start_date: string;
  end_date: string | null;
};

type RateSetDetailResponse = {
  rate_set?: RateSetRow;
  categories?: RateSetCategoryRow[];
  support_items?: RateSetSupportItemRow[];
  prices?: RateSetSupportItemPriceRow[];
  error?: string;
};

type RateSetListResponse = {
  rate_sets?: RateSetRow[];
  error?: string;
};

type SaveResponse = {
  id?: number;
  importedRows?: number;
  warnings?: string[];
  error?: string;
  details?: Record<string, string>;
};

type RateSetFormValues = {
  name: string;
  description?: string;
  start_date: Dayjs;
  end_date?: Dayjs;
};

function toDateString(value: Dayjs | undefined) {
  return value ? value.format('YYYY-MM-DD') : undefined;
}

function toMoney(value: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return parsed.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

export default function RateSetPage() {
  const [form] = Form.useForm<RateSetFormValues>();
  const [rateSets, setRateSets] = useState<RateSetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [detailRateSet, setDetailRateSet] = useState<RateSetRow | null>(null);
  const [detailCategories, setDetailCategories] = useState<RateSetCategoryRow[]>([]);
  const [detailItems, setDetailItems] = useState<RateSetSupportItemRow[]>([]);
  const [detailPrices, setDetailPrices] = useState<RateSetSupportItemPriceRow[]>([]);

  const supportItemById = useMemo(() => new Map(detailItems.map((item) => [item.id, item])), [detailItems]);

  const filteredRateSets = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return rateSets;
    }

    return rateSets.filter((rateSet) => {
      return (
        `${rateSet.id}`.includes(normalized) ||
        rateSet.name.toLowerCase().includes(normalized) ||
        (rateSet.description || '').toLowerCase().includes(normalized) ||
        rateSet.start_date.toLowerCase().includes(normalized) ||
        (rateSet.end_date || '').toLowerCase().includes(normalized)
      );
    });
  }, [rateSets, searchQuery]);

  const loadRateSets = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/rate-set', { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as RateSetListResponse;

      if (!response.ok) {
        throw new Error(result.error || 'Unable to load rate sets.');
      }

      setRateSets(result.rate_sets || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load rate sets.';
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRateSets();
  }, []);

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSelectedImportFile(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingId(null);
    setSelectedImportFile(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = async (id: number) => {
    try {
      const response = await fetch(`/api/rate-set?id=${id}`, { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as RateSetDetailResponse;

      if (!response.ok || !result.rate_set) {
        throw new Error(result.error || 'Unable to load rate set details.');
      }

      setEditingId(id);
      setSelectedImportFile(null);
      form.setFieldsValue({
        name: result.rate_set.name,
        description: result.rate_set.description || undefined,
        start_date: dayjs(result.rate_set.start_date),
        end_date: result.rate_set.end_date ? dayjs(result.rate_set.end_date) : undefined,
      });

      setIsModalOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load rate set details.';
      message.error(errorMessage);
    }
  };

  const openDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/rate-set?id=${id}`, { method: 'GET', cache: 'no-store' });
      const result = (await response.json()) as RateSetDetailResponse;

      if (!response.ok || !result.rate_set) {
        throw new Error(result.error || 'Unable to load rate set details.');
      }

      setDetailRateSet(result.rate_set);
      setDetailCategories(result.categories || []);
      setDetailItems(result.support_items || []);
      setDetailPrices(result.prices || []);
      setIsDrawerOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load rate set details.';
      message.error(errorMessage);
    }
  };

  const saveRateSet = async () => {
    const values = await form.validateFields();

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      start_date: toDateString(values.start_date),
      end_date: toDateString(values.end_date),
    };

    setIsSubmitting(true);

    try {
      let response: Response;

      if (!editingId && selectedImportFile) {
        const formData = new FormData();
        formData.append('file', selectedImportFile);
        formData.append('name', payload.name);
        if (payload.description) {
          formData.append('description', payload.description);
        }
        if (payload.start_date) {
          formData.append('start_date', payload.start_date);
        }
        if (payload.end_date) {
          formData.append('end_date', payload.end_date);
        }

        response = await fetch('/api/rate-set', {
          method: 'POST',
          body: formData,
        });
      } else {
        const endpoint = editingId ? `/api/rate-set?id=${editingId}` : '/api/rate-set';
        const method = editingId ? 'PATCH' : 'POST';

        response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = (await response.json()) as SaveResponse;

      if (!response.ok) {
        throw new Error(result.error || 'Unable to save rate set.');
      }

      if (!editingId && selectedImportFile) {
        const importedRows = result.importedRows ?? 0;
        const warnings = result.warnings || [];

        if (warnings.length > 0) {
          message.warning(`Rate set created. Imported ${importedRows} rows with ${warnings.length} warnings.`);
        } else {
          message.success(`Rate set created. Imported ${importedRows} rows.`);
        }
      } else {
        message.success(editingId ? 'Rate set updated.' : 'Rate set created.');
      }

      await loadRateSets();
      resetModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save rate set.';
      message.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRateSet = async (id: number) => {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/rate-set?id=${id}`, { method: 'DELETE' });
      const result = (await response.json()) as SaveResponse;

      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete rate set.');
      }

      message.success('Rate set deleted.');
      await loadRateSets();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to delete rate set.';
      message.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const modalUploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    maxCount: 1,
    beforeUpload: (file) => {
      setSelectedImportFile(file as File);
      return false;
    },
    onRemove: () => {
      setSelectedImportFile(null);
      return true;
    },
    fileList: selectedImportFile
      ? ([
          {
            uid: 'rate-set-import-file',
            name: selectedImportFile.name,
            status: 'done',
          },
        ] as UploadFile[])
      : [],
  };

  const columns: ColumnsType<RateSetRow> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (value: string | null) => value || 'Open',
    },
    {
      title: 'Categories',
      dataIndex: 'category_count',
      key: 'category_count',
    },
    {
      title: 'Support Items',
      dataIndex: 'support_item_count',
      key: 'support_item_count',
    },
    {
      title: 'Price Rows',
      dataIndex: 'price_count',
      key: 'price_count',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 230,
      render: (_: unknown, record: RateSetRow) => (
        <Space size={8}>
          <Button size="small" onClick={() => void openDetails(record.id)}>
            View
          </Button>
          <Button size="small" onClick={() => void openEditModal(record.id)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete rate set"
            description="This will soft delete this rate set and related rows."
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: deletingId === record.id }}
            onConfirm={() => void deleteRateSet(record.id)}
          >
            <Button danger size="small" loading={deletingId === record.id}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailPriceColumns: ColumnsType<RateSetSupportItemPriceRow> = [
    {
      title: 'Support Item',
      dataIndex: 'support_item_id',
      key: 'support_item_id',
      render: (value: number) => {
        const item = supportItemById.get(value);
        return item ? `${item.item_number} - ${item.item_name}` : `#${value}`;
      },
    },
    {
      title: 'Region',
      dataIndex: 'pricing_region_code',
      key: 'pricing_region_code',
      render: (value: string | null) => <Tag>{value || '-'}</Tag>,
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (value: string | null) => toMoney(value),
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (value: string) => value.slice(0, 10),
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (value: string | null) => (value ? value.slice(0, 10) : 'Open'),
    },
  ];

  return (
    <DashboardShell title="Rate Set">
      <div className="mx-auto w-full max-w-7xl">
        <Card className="border-slate-200/80 shadow-sm">
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={10}>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name / date / id"
                allowClear
              />
            </Col>
            <Col xs={24} md={14} className="flex flex-wrap justify-end gap-2">
              <Button type="primary" onClick={openCreateModal}>
                Add Rate Set
              </Button>
            </Col>
          </Row>
        </Card>

        <Card className="mt-6 border-slate-200/80 shadow-sm" title="Rate Sets">
          <Table<RateSetRow>
            rowKey="id"
            columns={columns}
            dataSource={filteredRateSets}
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1400 }}
          />
        </Card>
      </div>

      <Modal
        title={editingId ? 'Edit Rate Set' : 'Add Rate Set'}
        open={isModalOpen}
        onCancel={resetModal}
        onOk={() => void saveRateSet()}
        confirmLoading={isSubmitting}
        okText={editingId ? 'Update Rate Set' : 'Save Rate Set'}
        width={760}
  destroyOnClose
      >
        <Form<RateSetFormValues> form={form} layout="vertical" requiredMark={false}>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Name" name="name" rules={[{ required: true, message: 'name is required.' }]}>
                <Input placeholder="e.g. NDIS Support Catalogue 2025-26 v1.1" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={3} placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Start date" name="start_date" rules={[{ required: true, message: 'start_date is required.' }]}>
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="End date" name="end_date">
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          {!editingId ? (
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item label="Import NDIS Excel (optional)">
                  <Space direction="vertical" className="w-full">
                    <Upload {...modalUploadProps}>
                      <Button>Select Excel File</Button>
                    </Upload>
                    <Typography.Text type="secondary">
                      If a file is selected, saving this form will create the rate set and import the workbook into it.
                    </Typography.Text>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          ) : null}
        </Form>
      </Modal>

      <Drawer
        title={detailRateSet ? `Rate Set ${detailRateSet.id} - ${detailRateSet.name}` : 'Rate Set Details'}
        open={isDrawerOpen}
        width={1100}
        onClose={() => {
          setIsDrawerOpen(false);
          setDetailRateSet(null);
          setDetailCategories([]);
          setDetailItems([]);
          setDetailPrices([]);
        }}
      >
        {detailRateSet ? (
          <Space direction="vertical" className="w-full" size={16}>
            <Card className="border-slate-200/80">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Name</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.name}</div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Start Date</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.start_date.slice(0, 10)}</div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">End Date</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.end_date ? detailRateSet.end_date.slice(0, 10) : 'Open'}</div>
                </Col>
              </Row>

              <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Categories</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.category_count}</div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Support Items</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.support_item_count}</div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Price Rows</div>
                  <div className="mt-1 font-medium text-slate-900">{detailRateSet.price_count}</div>
                </Col>
              </Row>
            </Card>

            <Card className="border-slate-200/80" title="Support Items">
              <Table<RateSetSupportItemRow>
                rowKey="id"
                dataSource={detailItems}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Sorting', dataIndex: 'sorting', key: 'sorting' },
                  {
                    title: 'Category',
                    dataIndex: 'category_id',
                    key: 'category_id',
                    render: (value: number) => detailCategories.find((category) => category.id === value)?.category_name || `#${value}`,
                  },
                  { title: 'Item #', dataIndex: 'item_number', key: 'item_number' },
                  { title: 'Item Name', dataIndex: 'item_name', key: 'item_name' },
                  { title: 'Unit', dataIndex: 'unit', key: 'unit', render: (value: string | null) => value || '-' },
                ]}
              />
            </Card>

            <Card className="border-slate-200/80" title="Categories">
              <Table<RateSetCategoryRow>
                rowKey="id"
                dataSource={detailCategories}
                pagination={false}
                columns={[
                  { title: 'Sorting', dataIndex: 'sorting', key: 'sorting' },
                  { title: 'Category #', dataIndex: 'category_number', key: 'category_number' },
                  { title: 'Category Name', dataIndex: 'category_name', key: 'category_name' },
                ]}
              />
            </Card>

            <Card className="border-slate-200/80" title="Prices">
              <Table<RateSetSupportItemPriceRow>
                rowKey="id"
                dataSource={detailPrices}
                pagination={{ pageSize: 10 }}
                columns={detailPriceColumns}
                scroll={{ x: 1000 }}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </DashboardShell>
  );
}
