import { NextResponse } from 'next/server';

import { dbPool } from '@/lib/db';

type ParticipantPayload = {
  first_name?: string;
  last_name?: string;
  gender_id?: string;
  dob?: string;
  ndis_number?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  unit_building?: string;
  pricing_region?: string;
};

type ValidatedParticipant = {
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
};

type ParticipantRow = {
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function trimOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateParticipant(input: ParticipantPayload) {
  const errors: Record<string, string> = {};

  const firstName = trimOrEmpty(input.first_name);
  if (!firstName) {
    errors.first_name = 'first_name is required.';
  }

  const lastName = trimOrEmpty(input.last_name);
  if (!lastName) {
    errors.last_name = 'last_name is required.';
  }

  const genderId = trimOrEmpty(input.gender_id);
  if (!genderId) {
    errors.gender_id = 'gender_id is required.';
  }

  const dob = trimOrEmpty(input.dob);
  if (!dob) {
    errors.dob = 'dob is required.';
  } else if (!isIsoDate(dob)) {
    errors.dob = 'dob must be a valid date in YYYY-MM-DD format.';
  }

  const ndisNumber = trimOrEmpty(input.ndis_number);
  if (!ndisNumber) {
    errors.ndis_number = 'ndis_number is required.';
  } else if (!/^\d{1,16}$/.test(ndisNumber)) {
    errors.ndis_number = 'ndis_number must be digits only and up to 16 digits.';
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

  const address = trimOrEmpty(input.address);
  if (!address) {
    errors.address = 'address is required.';
  }

  const hasUnitBuilding = input.unit_building !== undefined && input.unit_building !== null;
  const unitBuilding = trimOrEmpty(input.unit_building);
  if (hasUnitBuilding && !unitBuilding) {
    errors.unit_building = 'unit_building cannot be empty if provided.';
  }

  const pricingRegion = trimOrEmpty(input.pricing_region);
  if (!pricingRegion) {
    errors.pricing_region = 'pricing_region is required.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    value: {
      first_name: firstName,
      last_name: lastName,
      gender_id: genderId,
      dob,
      ndis_number: ndisNumber,
      email,
      phone_number: phoneNumberTrimmed || null,
      address,
      unit_building: unitBuilding || null,
      pricing_region: pricingRegion,
    } satisfies ValidatedParticipant,
  };
}

async function ensureParticipantsTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id BIGSERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender_id TEXT NOT NULL,
      dob DATE NOT NULL,
      ndis_number VARCHAR(16) NOT NULL UNIQUE,
      email TEXT NOT NULL,
      phone_number VARCHAR(16),
      address TEXT NOT NULL,
      unit_building TEXT,
      pricing_region TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query(`
    ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    await ensureParticipantsTable();

    const result = await dbPool.query<ParticipantRow>(
      `
      SELECT
        id,
        first_name,
        last_name,
        gender_id,
        dob::text AS dob,
        ndis_number,
        email,
        phone_number,
        address,
        unit_building,
        pricing_region,
        created_at::text AS created_at
      FROM participants
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      `,
    );

    return NextResponse.json({ participants: result.rows }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load participants.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  let body: ParticipantPayload;

  try {
    body = (await request.json()) as ParticipantPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const validated = validateParticipant(body);
  if (!validated.ok) {
    return NextResponse.json({ error: 'Validation failed.', details: validated.errors }, { status: 400 });
  }

  try {
    await ensureParticipantsTable();

    const result = await dbPool.query(
      `
      INSERT INTO participants (
        first_name,
        last_name,
        gender_id,
        dob,
        ndis_number,
        email,
        phone_number,
        address,
        unit_building,
        pricing_region
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
      [
        validated.value.first_name,
        validated.value.last_name,
        validated.value.gender_id,
        validated.value.dob,
        validated.value.ndis_number,
        validated.value.email,
        validated.value.phone_number,
        validated.value.address,
        validated.value.unit_building,
        validated.value.pricing_region,
      ],
    );

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A participant with this NDIS number already exists.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to save participant.' }, { status: 500 });
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
    return NextResponse.json({ error: 'A valid participant id is required.' }, { status: 400 });
  }

  let body: ParticipantPayload;

  try {
    body = (await request.json()) as ParticipantPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const validated = validateParticipant(body);
  if (!validated.ok) {
    return NextResponse.json({ error: 'Validation failed.', details: validated.errors }, { status: 400 });
  }

  try {
    await ensureParticipantsTable();

    const result = await dbPool.query(
      `
      UPDATE participants
      SET
        first_name = $1,
        last_name = $2,
        gender_id = $3,
        dob = $4,
        ndis_number = $5,
        email = $6,
        phone_number = $7,
        address = $8,
        unit_building = $9,
        pricing_region = $10
      WHERE id = $11 AND deleted_at IS NULL
      RETURNING id
      `,
      [
        validated.value.first_name,
        validated.value.last_name,
        validated.value.gender_id,
        validated.value.dob,
        validated.value.ndis_number,
        validated.value.email,
        validated.value.phone_number,
        validated.value.address,
        validated.value.unit_building,
        validated.value.pricing_region,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'A participant with this NDIS number already exists.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to update participant.' }, { status: 500 });
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
    return NextResponse.json({ error: 'A valid participant id is required.' }, { status: 400 });
  }

  try {
    await ensureParticipantsTable();

    const result = await dbPool.query(
      `
      UPDATE participants
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete participant.' }, { status: 500 });
  }
}
