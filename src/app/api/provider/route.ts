import { NextResponse } from 'next/server';

import { dbPool } from '@/lib/db';

type ProviderPayload = {
  abn?: string;
  name?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  unit_building?: string;
};

type ValidatedProvider = {
  abn: string;
  name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  unit_building: string | null;
};

type ProviderRow = {
  id: number;
  abn: string;
  name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  unit_building: string | null;
  created_at: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function trimOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateProvider(input: ProviderPayload) {
  const errors: Record<string, string> = {};

  const abn = trimOrEmpty(input.abn);
  if (!abn) {
    errors.abn = 'abn is required.';
  } else if (!/^\d{1,11}$/.test(abn)) {
    errors.abn = 'abn must be digits only and up to 11 digits.';
  }

  const name = trimOrEmpty(input.name);
  if (!name) {
    errors.name = 'name is required.';
  }

  const email = trimOrEmpty(input.email);
  if (!email) {
    errors.email = 'email is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'email must be a valid email address.';
  }

  const phoneNumberTrimmed = trimOrEmpty(input.phone_number);
  if (phoneNumberTrimmed && !/^\d{3,16}$/.test(phoneNumberTrimmed)) {
    errors.phone_number = 'phone_number must be digits only and 3-16 digits.';
  }

  const hasAddress = input.address !== undefined && input.address !== null;
  const address = trimOrEmpty(input.address);
  if (hasAddress && !address) {
    errors.address = 'address cannot be empty if provided.';
  }

  const hasUnitBuilding = input.unit_building !== undefined && input.unit_building !== null;
  const unitBuilding = trimOrEmpty(input.unit_building);
  if (hasUnitBuilding && !unitBuilding) {
    errors.unit_building = 'unit_building cannot be empty if provided.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    value: {
      abn,
      name,
      email,
      phone_number: phoneNumberTrimmed || null,
      address: address || null,
      unit_building: unitBuilding || null,
    } satisfies ValidatedProvider,
  };
}

async function ensureProvidersTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id BIGSERIAL PRIMARY KEY,
      abn VARCHAR(11) NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone_number VARCHAR(16),
      address TEXT,
      unit_building TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    await ensureProvidersTable();

    const result = await dbPool.query<ProviderRow>(
      `
      SELECT
        id,
        abn,
        name,
        email,
        phone_number,
        address,
        unit_building,
        created_at::text AS created_at
      FROM providers
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      `,
    );

    return NextResponse.json({ providers: result.rows }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load providers.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  let body: ProviderPayload;

  try {
    body = (await request.json()) as ProviderPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const validated = validateProvider(body);
  if (!validated.ok) {
    return NextResponse.json({ error: 'Validation failed.', details: validated.errors }, { status: 400 });
  }

  try {
    await ensureProvidersTable();

    const result = await dbPool.query(
      `
      INSERT INTO providers (
        abn,
        name,
        email,
        phone_number,
        address,
        unit_building
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [
        validated.value.abn,
        validated.value.name,
        validated.value.email,
        validated.value.phone_number,
        validated.value.address,
        validated.value.unit_building,
      ],
    );

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A provider with this ABN already exists.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to save provider.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const id = Number(idParam);

  if (!idParam || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'A valid provider id is required.' }, { status: 400 });
  }

  let body: ProviderPayload;

  try {
    body = (await request.json()) as ProviderPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const validated = validateProvider(body);
  if (!validated.ok) {
    return NextResponse.json({ error: 'Validation failed.', details: validated.errors }, { status: 400 });
  }

  try {
    await ensureProvidersTable();

    const result = await dbPool.query(
      `
      UPDATE providers
      SET
        abn = $1,
        name = $2,
        email = $3,
        phone_number = $4,
        address = $5,
        unit_building = $6
      WHERE id = $7 AND deleted_at IS NULL
      RETURNING id
      `,
      [
        validated.value.abn,
        validated.value.name,
        validated.value.email,
        validated.value.phone_number,
        validated.value.address,
        validated.value.unit_building,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A provider with this ABN already exists.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to update provider.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const id = Number(idParam);

  if (!idParam || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'A valid provider id is required.' }, { status: 400 });
  }

  try {
    await ensureProvidersTable();

    const result = await dbPool.query(
      `
      UPDATE providers
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete provider.' }, { status: 500 });
  }
}