"use client";

import { useEffect, useMemo, useState } from 'react';

import dayjs, { type Dayjs } from 'dayjs';
import { Button, Card, Col, DatePicker, Form, Input, Modal, Popconfirm, Row, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { DashboardShell } from '@/components/dashboard-shell';

type ParticipantFormValues = {
  first_name: string;
  last_name: string;
  gender_id: string;
  dob: Dayjs;
  ndis_number: string;
  email: string;
  phone_number?: string;
  address: string;
  unit_building?: string;
  pricing_region: string;
};

type ParticipantRecord = {
  id: number;
  first_name: string;
  last_name: string;
  gender_id: string;
  dob: string;
  ndis_number: string;
  email: string;
  phone_number: string | null;
  address: string;
  unit_building: string | null;
  pricing_region: string;
  created_at: string;
};

const participantTableColumns: ColumnsType<ParticipantRecord> = [
  {
    title: 'First Name',
    dataIndex: 'first_name',
    key: 'first_name',
  },
  {
    title: 'Last Name',
    dataIndex: 'last_name',
    key: 'last_name',
  },
  {
    title: 'NDIS Number',
    dataIndex: 'ndis_number',
    key: 'ndis_number',
  },
  {
    title: 'Gender',
    dataIndex: 'gender_id',
    key: 'gender_id',
    render: (value: string) => <Tag className="capitalize">{value.replaceAll('_', ' ')}</Tag>,
  },
  {
    title: 'DOB',
    dataIndex: 'dob',
    key: 'dob',
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
    title: 'Pricing Region',
    dataIndex: 'pricing_region',
    key: 'pricing_region',
    render: (value: string) => value.replaceAll('_', ' '),
  },
];

const participantFieldNames: Array<keyof ParticipantFormValues> = [
  'first_name',
  'last_name',
  'gender_id',
  'dob',
  'ndis_number',
  'email',
  'phone_number',
  'address',
  'unit_building',
  'pricing_region',
];

const isParticipantFieldName = (name: string): name is keyof ParticipantFormValues => {
  return participantFieldNames.includes(name as keyof ParticipantFormValues);
};

const requiredTrimmedRule = (fieldLabel: string) => ({
  validator: (_: unknown, value: string | undefined) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return Promise.reject(new Error(`${fieldLabel} is required.`));
    }

    return Promise.resolve();
  },
});

export default function ParticipantsPage() {
  const [form] = Form.useForm<ParticipantFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState<number | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGender, setSearchGender] = useState<string | undefined>(undefined);
  const [searchPricingRegion, setSearchPricingRegion] = useState<string | undefined>(undefined);

  const filteredParticipants = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return participants.filter((participant) => {
      const matchesText =
        normalizedQuery.length === 0 ||
        participant.first_name.toLowerCase().includes(normalizedQuery) ||
        participant.last_name.toLowerCase().includes(normalizedQuery) ||
        participant.ndis_number.toLowerCase().includes(normalizedQuery) ||
        participant.email.toLowerCase().includes(normalizedQuery);

      const matchesGender = !searchGender || participant.gender_id === searchGender;
      const matchesPricingRegion = !searchPricingRegion || participant.pricing_region === searchPricingRegion;

      return matchesText && matchesGender && matchesPricingRegion;
    });
  }, [participants, searchGender, searchPricingRegion, searchQuery]);

  const loadParticipants = async () => {
    setIsTableLoading(true);

    try {
      const response = await fetch('/api/participants', {
        method: 'GET',
        cache: 'no-store',
      });

      const result = (await response.json()) as {
        participants?: ParticipantRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || 'Unable to load participants.');
      }

      setParticipants(result.participants || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load participants.';
      message.error(errorMessage);
    } finally {
      setIsTableLoading(false);
    }
  };

  useEffect(() => {
    void loadParticipants();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingParticipantId(null);
    form.resetFields();
  };

  const openAddParticipantModal = () => {
    setEditingParticipantId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditParticipantModal = (participant: ParticipantRecord) => {
    setEditingParticipantId(participant.id);
    form.setFieldsValue({
      first_name: participant.first_name,
      last_name: participant.last_name,
      gender_id: participant.gender_id,
      dob: dayjs(participant.dob),
      ndis_number: participant.ndis_number,
      email: participant.email,
      phone_number: participant.phone_number || undefined,
      address: participant.address,
      unit_building: participant.unit_building || undefined,
      pricing_region: participant.pricing_region,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    const payload = {
      ...values,
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      address: values.address.trim(),
      unit_building: values.unit_building?.trim() || undefined,
      ndis_number: values.ndis_number.trim(),
      email: values.email.trim(),
      phone_number: values.phone_number?.trim() || undefined,
      dob: values.dob.format('YYYY-MM-DD'),
    };

    setIsSubmitting(true);

    try {
      const isEditing = editingParticipantId !== null;
      const endpoint = isEditing ? `/api/participants?id=${editingParticipantId}` : '/api/participants';
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
            if (isParticipantFieldName(name)) {
              fields.push({
                name,
                errors: [err],
              });
            }
          }

          form.setFields(fields);
        }

        throw new Error(result.error || 'Unable to save participant.');
      }

      message.success(isEditing ? 'Participant updated successfully.' : 'Participant saved successfully.');
      await loadParticipants();
      closeModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save participant.';
      message.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteParticipant = async (participantId: number) => {
    setDeletingParticipantId(participantId);

    try {
      const response = await fetch(`/api/participants?id=${participantId}`, {
        method: 'DELETE',
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || 'Unable to delete participant.');
      }

      message.success('Participant deleted.');
      await loadParticipants();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to delete participant.';
      message.error(errorMessage);
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const tableColumns = useMemo<ColumnsType<ParticipantRecord>>(
    () => [
      ...participantTableColumns,
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 200,
        render: (_: unknown, record: ParticipantRecord) => (
          <div className="flex gap-2">
            <Button size="small" onClick={() => openEditParticipantModal(record)}>
              Edit
            </Button>
            <Popconfirm
              title="Delete participant"
              description="This will hide the participant from active lists but keep historical records."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingParticipantId === record.id }}
              cancelText="Cancel"
              onConfirm={() => handleDeleteParticipant(record.id)}
            >
              <Button danger size="small" loading={deletingParticipantId === record.id}>
                Delete
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [deletingParticipantId, handleDeleteParticipant, openEditParticipantModal],
  );

  return (
    <DashboardShell title="Participants">
      <div className="mx-auto w-full max-w-7xl">
        <Card className="border-slate-200/80 shadow-sm">
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={12} xl={8}>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="First name / Last name / NDIS / Email"
                allowClear
              />
            </Col>
            <Col xs={24} md={6} xl={5}>
              <Select
                className="w-full"
                value={searchGender}
                onChange={(value) => setSearchGender(value)}
                placeholder="Gender"
                allowClear
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                ]}
              />
            </Col>
            <Col xs={24} md={6} xl={5}>
              <Select
                className="w-full"
                value={searchPricingRegion}
                onChange={(value) => setSearchPricingRegion(value)}
                placeholder="Pricing region"
                allowClear
                options={[
                  { value: 'metro', label: 'Metro' },
                  { value: 'regional', label: 'Regional' },
                  { value: 'remote', label: 'Remote' },
                ]}
              />
            </Col>
            <Col xs={24} xl={6} className="flex justify-end">
              <Button type="primary" size="large" onClick={openAddParticipantModal}>
                Add Participant
              </Button>
            </Col>
          </Row>
        </Card>

        <Card className="mt-6 border-slate-200/80 shadow-sm" title="Participants List">
          <Table<ParticipantRecord>
            rowKey="id"
            columns={tableColumns}
            dataSource={filteredParticipants}
            loading={isTableLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>
      </div>

      <Modal
        title={editingParticipantId ? 'Edit Participant' : 'Add Participant'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={editingParticipantId ? 'Update Participant' : 'Save Participant'}
        confirmLoading={isSubmitting}
        width={880}
        destroyOnClose
      >
        <Form<ParticipantFormValues> form={form} layout="vertical" requiredMark={false}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="First name" name="first_name" rules={[requiredTrimmedRule('First name')]}>
                <Input placeholder="Enter first name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Last name" name="last_name" rules={[requiredTrimmedRule('Last name')]}>
                <Input placeholder="Enter last name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Gender" name="gender_id" rules={[{ required: true, message: 'Gender is required.' }]}>
                <Select
                  placeholder="Select gender"
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Date of birth" name="dob" rules={[{ required: true, message: 'Date of birth is required.' }]}>
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="NDIS number"
                name="ndis_number"
                rules={[
                  { required: true, message: 'NDIS number is required.' },
                  { pattern: /^\d{1,16}$/, message: 'NDIS number must be digits only and up to 16 digits.' },
                ]}
              >
                <Input placeholder="Digits only" maxLength={16} inputMode="numeric" />
              </Form.Item>
            </Col>
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
          </Row>

          <Row gutter={16}>
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
            <Col xs={24} md={12}>
              <Form.Item label="Pricing region" name="pricing_region" rules={[{ required: true, message: 'Pricing region is required.' }]}>
                <Select
                  placeholder="Select pricing region"
                  options={[
                    { value: 'ACT', label: 'Australian Capital Territory (ACT)' },
                    { value: 'NSW', label: 'New South Wales (NSW)' },
                    { value: 'NT', label: 'Northern Territory (NT)' },
                    { value: 'QLD', label: 'Queensland (QLD)' },
                    { value: 'SA', label: 'South Australia (SA)' },
                    { value: 'TAS', label: 'Tasmania (TAS)' },
                    { value: 'VIC', label: 'Victoria (VIC)' },
                    { value: 'WA', label: 'Western Australia (WA)' },
                    { value: 'REMOTE', label: 'Remote' },
                    { value: 'VERY_REMOTE', label: 'Very Remote' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Address" name="address" rules={[requiredTrimmedRule('Address')]}>
            <Input.TextArea rows={3} placeholder="Enter address" />
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