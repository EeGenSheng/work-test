import { NextResponse } from 'next/server';

import { dbPool } from '@/lib/db';

type InvoiceStatus = 'drafted' | 'completed';

type InvoicePayload = {
  client_id?: string | number;
  provider_id?: string | number;
  invoice_number?: string;
  invoice_date?: string;
  expected_amount?: string | number;
  status?: InvoiceStatus;
  items?: InvoiceItemPayload[];
};

type InvoiceItemPayload = {
  id?: string | number;
  rate_set_id?: string | number;
  category_id?: string | number;
  support_item_id?: string | number;
  start_date?: string;
  end_date?: string;
  max_rate?: string | number;
  unit?: string | number;
  input_rate?: string | number;
};

type LookupRow = {
  id: number;
  name: string;
};

type ClientLookupRow = LookupRow & {
  pricing_region: string;
};

type CategoryLookupRow = LookupRow & {
  rate_set_id: number;
};

type ProviderLookupRow = {
  id: number;
  name: string;
  abn: string;
};

type SupportItemLookupRow = {
  id: number;
  rate_set_id: number;
  category_id: number;
  name: string;
};

type RateSetLookupRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
};

type PriceLookupRow = {
  rate_set_id: number;
  support_item_id: number;
  pricing_region: string;
  unit_price: string;
};

type InvoiceRow = {
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

type InvoiceItemRow = {
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
  created_at: string;
  updated_at: string;
};

type LookupData = {
  clients: ClientLookupRow[];
  providers: ProviderLookupRow[];
  categories: CategoryLookupRow[];
  supportItems: SupportItemLookupRow[];
  rateSets: RateSetLookupRow[];
  prices: PriceLookupRow[];
};

type InvoiceDetail = InvoiceRow & {
  items: InvoiceItemRow[];
};

type ValidationErrorMap = Record<string, string>;

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toDateStringOrNull(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

async function ensureInvoiceTables() {
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
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id BIGSERIAL PRIMARY KEY,
      abn VARCHAR(11) NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone_number VARCHAR(16),
      address TEXT,
      unit_building TEXT,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query(`
    ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS abn VARCHAR(11)
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS name TEXT
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS email TEXT
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(16)
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS address TEXT
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS unit_building TEXT
  `);

  await dbPool.query(`
    ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await dbPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS providers_abn_active_idx
    ON providers (abn)
    WHERE deleted_at IS NULL
      AND abn IS NOT NULL
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      description text,
      start_date timestamptz NOT NULL,
      end_date timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz,
      deleted_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_category (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rate_set_id int NOT NULL REFERENCES rate_set(id),
      category_number text NOT NULL,
      category_name text NOT NULL,
      sorting int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz,
      deleted_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rate_set_id int NOT NULL REFERENCES rate_set(id),
      category_id int NOT NULL REFERENCES rate_set_category(id),
      item_number text NOT NULL,
      item_name text NOT NULL,
      unit text,
      sorting int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz,
      deleted_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_price (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rate_set_id int NOT NULL REFERENCES rate_set(id),
      support_item_id int NOT NULL REFERENCES rate_set_support_item(id),
      type_id int,
      pricing_region_code text,
      unit_price numeric(24, 4),
      start_date timestamptz NOT NULL,
      end_date timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (
        rate_set_id,
        support_item_id,
        type_id,
        pricing_region_code,
        start_date,
        end_date
      )
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      provider_id BIGINT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date DATE NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      expected_amount NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_number_active_idx
    ON invoices (provider_id, invoice_number)
    WHERE deleted_at IS NULL
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id BIGSERIAL PRIMARY KEY,
      invoice_id BIGINT NOT NULL,
      rate_set_id BIGINT,
      category_id BIGINT,
      support_item_id BIGINT,
      start_date DATE,
      end_date DATE,
      max_rate NUMERIC(12,2),
      unit NUMERIC(12,2),
      input_rate NUMERIC(12,2),
      amount NUMERIC(12,2),
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

}

async function loadLookupData(): Promise<LookupData> {
  const [clients, providers, categories, supportItems, rateSets, prices] = await Promise.all([
    dbPool.query<ClientLookupRow>(`SELECT id, CONCAT_WS(' ', first_name, last_name) AS name, pricing_region FROM participants WHERE deleted_at IS NULL ORDER BY id`),
    dbPool.query<ProviderLookupRow>(`SELECT id, name, abn FROM providers WHERE deleted_at IS NULL ORDER BY id`),
    dbPool.query<CategoryLookupRow>(`SELECT id, rate_set_id, category_name AS name FROM rate_set_category WHERE deleted_at IS NULL ORDER BY sorting, id`),
    dbPool.query<SupportItemLookupRow>(`SELECT id, rate_set_id, category_id, item_name AS name FROM rate_set_support_item WHERE deleted_at IS NULL ORDER BY sorting, id`),
    dbPool.query<RateSetLookupRow>(`SELECT id, name, start_date::text AS start_date, end_date::text AS end_date FROM rate_set WHERE deleted_at IS NULL ORDER BY id`),
    dbPool.query<PriceLookupRow>(`SELECT rate_set_id, support_item_id, pricing_region_code AS pricing_region, unit_price::text AS unit_price FROM rate_set_support_item_price ORDER BY id`),
  ]);

  return {
    clients: clients.rows,
    providers: providers.rows,
    categories: categories.rows,
    supportItems: supportItems.rows,
    rateSets: rateSets.rows,
    prices: prices.rows,
  };
}

function normalizeInvoiceBase(payload: InvoicePayload) {
  const clientId = toNumberOrNull(payload.client_id);
  const providerId = toNumberOrNull(payload.provider_id);
  const invoiceNumber = toTrimmedString(payload.invoice_number);
  const invoiceDate = toDateStringOrNull(payload.invoice_date);
  const expectedAmount = toNumberOrNull(payload.expected_amount);
  const status = payload.status ?? 'drafted';

  return {
    clientId,
    providerId,
    invoiceNumber,
    invoiceDate,
    expectedAmount,
    status,
  };
}

function normalizeDecimal(value: unknown) {
  const parsed = toNumberOrNull(value);
  return parsed === null ? null : round2(parsed);
}

async function validateInvoiceNumberUnique(providerId: number, invoiceNumber: string, invoiceId?: number) {
  const result = await dbPool.query<{ id: number }>(
    `SELECT id FROM invoices WHERE provider_id = $1 AND invoice_number = $2 AND deleted_at IS NULL AND ($3::bigint IS NULL OR id <> $3)
    `,
    [providerId, invoiceNumber, invoiceId ?? null],
  );

  return result.rowCount === 0;
}

async function getActiveClient(clientId: number) {
  const result = await dbPool.query<{ id: number; pricing_region: string }>(
    `SELECT id, pricing_region FROM participants WHERE id = $1 AND deleted_at IS NULL`,
    [clientId],
  );

  return result.rows[0] ?? null;
}

async function getActiveProvider(providerId: number) {
  const result = await dbPool.query<{ id: number }>(`SELECT id FROM providers WHERE id = $1 AND deleted_at IS NULL`, [providerId]);
  return result.rows[0] ?? null;
}

async function getRateSetCandidates(startDate: string, endDate: string) {
  const result = await dbPool.query<RateSetLookupRow>(
    `
    SELECT id, start_date::text AS start_date, end_date::text AS end_date
    FROM rate_set
    WHERE deleted_at IS NULL
      AND (start_date AT TIME ZONE 'UTC')::date <= $1::date
      AND (end_date IS NULL OR (end_date AT TIME ZONE 'UTC')::date >= $2::date)
    ORDER BY id
    `,
    [startDate, endDate],
  );

  return result.rows;
}

async function getSupportItem(categoryId: number, supportItemId: number, rateSetId: number) {
  const result = await dbPool.query<SupportItemLookupRow>(
    `
    SELECT id, category_id, item_name AS name
    FROM rate_set_support_item
    WHERE id = $1
      AND rate_set_id = $2
      AND deleted_at IS NULL
    `,
    [supportItemId, rateSetId],
  );

  const row = result.rows[0];
  if (!row || row.category_id !== categoryId) {
    return null;
  }

  return row;
}

async function getPrice(rateSetId: number, supportItemId: number, pricingRegion: string, startDate: string, endDate: string) {
  const normalizedRegion = pricingRegion.trim().replaceAll(' ', '_').toUpperCase();

  const result = await dbPool.query<PriceLookupRow>(
    `
    SELECT rate_set_id, support_item_id, pricing_region, unit_price::text AS unit_price
    FROM (
      SELECT rate_set_id, support_item_id, pricing_region_code AS pricing_region, unit_price, start_date, end_date
      FROM rate_set_support_item_price
    ) price
    WHERE rate_set_id = $1
      AND support_item_id = $2
      AND pricing_region = $3
      AND (start_date AT TIME ZONE 'UTC')::date <= $4::date
      AND (end_date IS NULL OR (end_date AT TIME ZONE 'UTC')::date >= $5::date)
    LIMIT 1
    `,
    [rateSetId, supportItemId, normalizedRegion, startDate, endDate],
  );

  return result.rows[0] ?? null;
}

function addError(errors: ValidationErrorMap, key: string, message: string) {
  if (!errors[key]) {
    errors[key] = message;
  }
}

async function normalizeInvoiceItems(
  items: InvoiceItemPayload[] | undefined,
  mode: InvoiceStatus,
  pricingRegion: string | null,
  invoiceId: number | null,
  clientId: number | null,
): Promise<{ rows: Array<Record<string, unknown>>; errors: ValidationErrorMap; totalAmount: number }> {
  const errors: ValidationErrorMap = {};
  const normalizedRows: Array<Record<string, unknown>> = [];
  let totalAmount = 0;

  const safeItems = Array.isArray(items) ? items : [];

  for (let index = 0; index < safeItems.length; index += 1) {
    const item = safeItems[index];
    const prefix = `items.${index}`;

    const rateSetId = toNumberOrNull(item?.rate_set_id);
    const categoryId = toNumberOrNull(item?.category_id);
    const supportItemId = toNumberOrNull(item?.support_item_id);
    const startDate = toDateStringOrNull(item?.start_date);
    const endDate = toDateStringOrNull(item?.end_date);
    const maxRate = normalizeDecimal(item?.max_rate);
    const unit = normalizeDecimal(item?.unit);
    const inputRate = normalizeDecimal(item?.input_rate);

    const row: Record<string, unknown> = {
      id: toNumberOrNull(item?.id),
      invoice_id: invoiceId,
      rate_set_id: rateSetId,
      category_id: categoryId,
      support_item_id: supportItemId,
      start_date: startDate,
      end_date: endDate,
      max_rate: maxRate !== null ? maxRate : undefined,
      unit,
      input_rate: inputRate,
      amount: null,
    };

    if (mode === 'completed') {
      if (rateSetId === null) {
        addError(errors, `${prefix}.rate_set_id`, 'rate_set_id is required.');
      }
      if (categoryId === null) {
        addError(errors, `${prefix}.category_id`, 'category_id is required.');
      }
      if (supportItemId === null) {
        addError(errors, `${prefix}.support_item_id`, 'support_item_id is required.');
      }
      if (!startDate) {
        addError(errors, `${prefix}.start_date`, 'start_date is required.');
      }
      if (!endDate) {
        addError(errors, `${prefix}.end_date`, 'end_date is required.');
      }
      if (startDate && endDate && startDate > endDate) {
        addError(errors, `${prefix}.end_date`, 'end_date must be greater than or equal to start_date.');
      }
      if (unit === null) {
        addError(errors, `${prefix}.unit`, 'unit is required.');
      }
      if (inputRate === null) {
        addError(errors, `${prefix}.input_rate`, 'input_rate is required.');
      }
    }

    const canValidatePricing = rateSetId !== null && categoryId !== null && supportItemId !== null && startDate && endDate && clientId !== null && pricingRegion !== null;

    let matchedRateSetId: number | null = null;
    let derivedMaxRate: number | null = null;

    if (canValidatePricing) {
      const matchedRateSets = await getRateSetCandidates(startDate, endDate);
      if (matchedRateSets.length === 0) {
        if (mode === 'completed') {
          addError(errors, `${prefix}.rate_set_id`, 'No matching rate set found for the selected date range.');
        }
      } else if (matchedRateSets.length > 1) {
        addError(errors, `${prefix}.rate_set_id`, 'More than one rate set matches the selected date range.');
      } else {
        matchedRateSetId = matchedRateSets[0].id;
        if (rateSetId !== matchedRateSetId) {
          addError(errors, `${prefix}.rate_set_id`, 'Selected rate_set_id does not match the date range.');
        }

        const supportItem = await getSupportItem(categoryId, supportItemId, matchedRateSetId);
        if (!supportItem) {
          addError(errors, `${prefix}.support_item_id`, 'support_item_id does not match category_id.');
        }

        if (pricingRegion !== null) {
          const price = await getPrice(matchedRateSetId, supportItemId, pricingRegion, startDate, endDate);
          if (!price) {
            addError(errors, `${prefix}.max_rate`, 'No matching max_rate could be found for the selected client pricing region.');
          } else {
            derivedMaxRate = normalizeDecimal(price.unit_price);
            if (mode === 'completed' && maxRate !== null && derivedMaxRate !== null && round2(maxRate) !== derivedMaxRate) {
              addError(errors, `${prefix}.max_rate`, 'max_rate must match the derived unit price.');
            }
          }
        }
      }
    }

    if (unit !== null && inputRate !== null) {
      const amount = round2(unit * inputRate);
      row.amount = amount;
      totalAmount += amount;
      if (mode === 'completed' && derivedMaxRate !== null && maxRate !== null && maxRate < derivedMaxRate) {
        addError(errors, `${prefix}.max_rate`, 'max_rate cannot be less than the derived unit price.');
      }
    } else if (mode === 'completed') {
      addError(errors, `${prefix}.amount`, 'amount could not be derived from unit and input_rate.');
    }

    if (maxRate === null && derivedMaxRate !== null) {
      row.max_rate = derivedMaxRate;
    }

    normalizedRows.push(row);
  }

  return {
    rows: normalizedRows,
    errors,
    totalAmount: round2(totalAmount),
  };
}

async function loadInvoicesList(): Promise<{ invoices: InvoiceRow[]; lookups: LookupData }> {
  const [invoicesResult, lookups] = await Promise.all([
    dbPool.query<InvoiceRow>(
      `
      SELECT
        i.id,
        i.client_id,
        i.provider_id,
        i.invoice_number,
        i.invoice_date::text AS invoice_date,
        i.amount::text AS amount,
        i.expected_amount::text AS expected_amount,
        i.status,
        i.created_at::text AS created_at,
        i.updated_at::text AS updated_at,
        CONCAT_WS(' ', c.first_name, c.last_name) AS client_name,
        c.pricing_region AS client_region,
        p.name AS provider_name,
        p.abn AS provider_abn,
        COALESCE(item_counts.item_count, 0)::int AS item_count
      FROM invoices i
      LEFT JOIN participants c ON c.id = i.client_id
      LEFT JOIN providers p ON p.id = i.provider_id
      LEFT JOIN (
        SELECT invoice_id, COUNT(*)::int AS item_count
        FROM invoice_items
        WHERE deleted_at IS NULL
        GROUP BY invoice_id
      ) item_counts ON item_counts.invoice_id = i.id
      WHERE i.deleted_at IS NULL
      ORDER BY i.created_at DESC
      `,
    ),
    loadLookupData(),
  ]);

  return { invoices: invoicesResult.rows, lookups };
}

async function loadInvoiceDetail(invoiceId: number): Promise<InvoiceDetail | null> {
  const invoiceResult = await dbPool.query<InvoiceRow>(
    `
    SELECT
      i.id,
      i.client_id,
      i.provider_id,
      i.invoice_number,
      i.invoice_date::text AS invoice_date,
      i.amount::text AS amount,
      i.expected_amount::text AS expected_amount,
      i.status,
      i.created_at::text AS created_at,
      i.updated_at::text AS updated_at,
      CONCAT_WS(' ', c.first_name, c.last_name) AS client_name,
      c.pricing_region AS client_region,
      p.name AS provider_name,
      p.abn AS provider_abn,
      COALESCE(item_counts.item_count, 0)::int AS item_count
    FROM invoices i
    LEFT JOIN participants c ON c.id = i.client_id
    LEFT JOIN providers p ON p.id = i.provider_id
    LEFT JOIN (
      SELECT invoice_id, COUNT(*)::int AS item_count
      FROM invoice_items
      WHERE deleted_at IS NULL
      GROUP BY invoice_id
    ) item_counts ON item_counts.invoice_id = i.id
    WHERE i.id = $1 AND i.deleted_at IS NULL
    `,
    [invoiceId],
  );

  const invoice = invoiceResult.rows[0];
  if (!invoice) {
    return null;
  }

  const itemsResult = await dbPool.query<InvoiceItemRow>(
    `
    SELECT
      id,
      invoice_id,
      rate_set_id,
      category_id,
      support_item_id,
      start_date::text AS start_date,
      end_date::text AS end_date,
      max_rate::text AS max_rate,
      unit::text AS unit,
      input_rate::text AS input_rate,
      amount::text AS amount,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM invoice_items
    WHERE invoice_id = $1 AND deleted_at IS NULL
    ORDER BY id
    `,
    [invoiceId],
  );

  return {
    ...invoice,
    items: itemsResult.rows,
  };
}

async function ensureInvoiceBaseRequirements(payload: ReturnType<typeof normalizeInvoiceBase>, invoiceId?: number) {
  const errors: ValidationErrorMap = {};

  if (payload.clientId === null) {
    addError(errors, 'client_id', 'client_id is required.');
  }
  if (payload.providerId === null) {
    addError(errors, 'provider_id', 'provider_id is required.');
  }
  if (!payload.invoiceNumber) {
    addError(errors, 'invoice_number', 'invoice_number is required.');
  }
  if (!payload.invoiceDate || !isValidDateString(payload.invoiceDate)) {
    addError(errors, 'invoice_date', 'invoice_date is required.');
  }
  if (payload.expectedAmount === null) {
    addError(errors, 'expected_amount', 'expected_amount is required.');
  }

  if (payload.status !== 'drafted' && payload.status !== 'completed') {
    addError(errors, 'status', 'status is required and must be drafted or completed.');
  }

  if (payload.clientId !== null) {
    const client = await getActiveClient(payload.clientId);
    if (!client) {
      addError(errors, 'client_id', 'client_id must reference an active participant.');
    }
  }

  if (payload.providerId !== null) {
    const provider = await getActiveProvider(payload.providerId);
    if (!provider) {
      addError(errors, 'provider_id', 'provider_id must reference an active provider.');
    }
  }

  if (payload.clientId !== null && payload.providerId !== null && payload.invoiceNumber) {
    const unique = await validateInvoiceNumberUnique(payload.providerId, payload.invoiceNumber, invoiceId);
    if (!unique) {
      addError(errors, 'invoice_number', 'invoice_number must be unique per provider_id.');
    }
  }

  return errors;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    await ensureInvoiceTables();

    const requestUrl = new URL(request.url);
    const idParam = requestUrl.searchParams.get('id');

    if (idParam) {
      const invoiceId = Number(idParam);
      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return NextResponse.json({ error: 'A valid invoice id is required.' }, { status: 400 });
      }

      const invoice = await loadInvoiceDetail(invoiceId);
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
      }

      return NextResponse.json({ invoice, lookups: await loadLookupData() }, { status: 200 });
    }

    const { invoices, lookups } = await loadInvoicesList();
    return NextResponse.json({ invoices, lookups }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load invoices.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return saveInvoice(request, undefined);
}

export async function PATCH(request: Request) {
  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const invoiceId = Number(idParam);

  if (!idParam || !Number.isInteger(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'A valid invoice id is required.' }, { status: 400 });
  }

  return saveInvoice(request, invoiceId);
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const invoiceId = Number(idParam);

  if (!idParam || !Number.isInteger(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'A valid invoice id is required.' }, { status: 400 });
  }

  try {
    await ensureInvoiceTables();

    const invoice = await dbPool.query<{ id: number }>(`SELECT id FROM invoices WHERE id = $1 AND deleted_at IS NULL`, [invoiceId]);
    if (invoice.rowCount === 0) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    await dbPool.query(`UPDATE invoice_items SET deleted_at = NOW(), updated_at = NOW() WHERE invoice_id = $1 AND deleted_at IS NULL`, [invoiceId]);
    await dbPool.query(`UPDATE invoices SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [invoiceId]);

    return NextResponse.json({ id: invoiceId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete invoice.' }, { status: 500 });
  }
}

async function saveInvoice(request: Request, invoiceId?: number) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  let payload: InvoicePayload;

  try {
    payload = (await request.json()) as InvoicePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const normalized = normalizeInvoiceBase(payload);
  const mode: InvoiceStatus = normalized.status === 'completed' ? 'completed' : 'drafted';

  try {
    await ensureInvoiceTables();

    const baseErrors = await ensureInvoiceBaseRequirements(normalized, invoiceId);

    const client = normalized.clientId !== null ? await getActiveClient(normalized.clientId) : null;
    const pricingRegion = client?.pricing_region ?? null;

    const itemValidation = await normalizeInvoiceItems(payload.items, mode, pricingRegion, invoiceId ?? null, normalized.clientId);

    const errors: ValidationErrorMap = {
      ...baseErrors,
      ...itemValidation.errors,
    };

    if (mode === 'completed') {
      const hasAnyItems = Array.isArray(payload.items) && payload.items.length > 0;
      if (!hasAnyItems) {
        addError(errors, 'items', 'At least one invoice item is required to complete an invoice.');
      }

      if (normalized.expectedAmount !== null && itemValidation.totalAmount < normalized.expectedAmount) {
        addError(errors, 'expected_amount', 'expected_amount must be less than or equal to amount.');
      }
    }

    if (Object.keys(errors).length > 0 && mode === 'completed') {
      return NextResponse.json({ error: 'Validation failed.', details: errors }, { status: 400 });
    }

    if (normalized.clientId === null || normalized.providerId === null || !normalized.invoiceNumber || !normalized.invoiceDate || normalized.expectedAmount === null) {
      return NextResponse.json({ error: 'Validation failed.', details: errors }, { status: 400 });
    }

    const computedAmount = round2(itemValidation.totalAmount);

    const result = await dbPool.query<{ id: number }>(
      invoiceId
        ? `
          UPDATE invoices
          SET
            client_id = $1,
            provider_id = $2,
            invoice_number = $3,
            invoice_date = $4,
            amount = $5,
            expected_amount = $6,
            status = $7,
            updated_at = NOW()
          WHERE id = $8 AND deleted_at IS NULL
          RETURNING id
          `
        : `
          INSERT INTO invoices (
            client_id,
            provider_id,
            invoice_number,
            invoice_date,
            amount,
            expected_amount,
            status
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING id
          `,
      invoiceId
        ? [
            normalized.clientId,
            normalized.providerId,
            normalized.invoiceNumber,
            normalized.invoiceDate,
            computedAmount,
            normalized.expectedAmount,
            mode,
            invoiceId,
          ]
        : [
            normalized.clientId,
            normalized.providerId,
            normalized.invoiceNumber,
            normalized.invoiceDate,
            computedAmount,
            normalized.expectedAmount,
            mode,
          ],
    );

    const savedInvoiceId = result.rows[0]?.id;
    if (!savedInvoiceId) {
      return NextResponse.json({ error: 'Failed to save invoice.' }, { status: 500 });
    }

    if (invoiceId) {
      await dbPool.query(`UPDATE invoice_items SET deleted_at = NOW(), updated_at = NOW() WHERE invoice_id = $1 AND deleted_at IS NULL`, [savedInvoiceId]);
    }

    for (const item of itemValidation.rows) {
      await dbPool.query(
        `
        INSERT INTO invoice_items (
          invoice_id,
          rate_set_id,
          category_id,
          support_item_id,
          start_date,
          end_date,
          max_rate,
          unit,
          input_rate,
          amount,
          deleted_at,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,NOW(),NOW())
        `,
        [
          savedInvoiceId,
          item.rate_set_id,
          item.category_id,
          item.support_item_id,
          item.start_date,
          item.end_date,
          item.max_rate,
          item.unit,
          item.input_rate,
          item.amount,
        ],
      );
    }

    return NextResponse.json({ id: savedInvoiceId, status: mode, amount: computedAmount }, { status: invoiceId ? 200 : 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'invoice_number must be unique per provider_id.' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to save invoice.' }, { status: 500 });
  }
}