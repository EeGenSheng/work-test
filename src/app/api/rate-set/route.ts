import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { dbPool } from '@/lib/db';

type RateSetPayload = {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string | null;
};

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

type AttributeTypeMapEntry = {
  headerCandidates: string[];
  fallbackIndex: number;
  code:
    | 'IS_QUOTE_REQUIRED'
    | 'IS_NF2F_SUPPORT_PROVISION'
    | 'IS_PROVIDER_TRAVEL'
    | 'IS_SHORT_NOTICE_CANCEL'
    | 'IS_NDIA_REQUESTED_REPORTS'
    | 'IS_IRREGULAR_SIL_SUPPORTS';
};

type RegionColumn = {
  headerCandidates: string[];
  fallbackIndex: number;
  fullLabel: string;
};

const ATTRIBUTE_COLUMNS: AttributeTypeMapEntry[] = [
  { headerCandidates: ['Quote'], fallbackIndex: 9, code: 'IS_QUOTE_REQUIRED' }, // J
  { headerCandidates: ['Non-Face-to-Face Support Provision'], fallbackIndex: 22, code: 'IS_NF2F_SUPPORT_PROVISION' }, // W
  { headerCandidates: ['Provider Travel'], fallbackIndex: 23, code: 'IS_PROVIDER_TRAVEL' }, // X
  { headerCandidates: ['Short Notice Cancellations.'], fallbackIndex: 24, code: 'IS_SHORT_NOTICE_CANCEL' }, // Y
  { headerCandidates: ['NDIA Requested Reports'], fallbackIndex: 25, code: 'IS_NDIA_REQUESTED_REPORTS' }, // Z
  { headerCandidates: ['Irregular SIL Supports'], fallbackIndex: 26, code: 'IS_IRREGULAR_SIL_SUPPORTS' }, // AA
];

const REGION_COLUMNS: RegionColumn[] = [
  { headerCandidates: ['ACT'], fallbackIndex: 12, fullLabel: 'Australian Capital Territory' }, // M
  { headerCandidates: ['NSW'], fallbackIndex: 13, fullLabel: 'New South Wales' }, // N
  { headerCandidates: ['NT'], fallbackIndex: 14, fullLabel: 'Northern Territory' }, // O
  { headerCandidates: ['QLD'], fallbackIndex: 15, fullLabel: 'Queensland' }, // P
  { headerCandidates: ['SA'], fallbackIndex: 16, fullLabel: 'South Australia' }, // Q
  { headerCandidates: ['TAS'], fallbackIndex: 17, fullLabel: 'Tasmania' }, // R
  { headerCandidates: ['VIC'], fallbackIndex: 18, fullLabel: 'Victoria' }, // S
  { headerCandidates: ['WA'], fallbackIndex: 19, fullLabel: 'Western Australia' }, // T
  { headerCandidates: ['Remote'], fallbackIndex: 20, fullLabel: 'Remote' }, // U
  { headerCandidates: ['Very Remote'], fallbackIndex: 21, fullLabel: 'Very Remote' }, // V
];

const GENDERS = ['Female', 'Male', 'Unidentified'];

function trimOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cellToText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`.trim();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return '';
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }

    const year = `${parsed.y}`.padStart(4, '0');
    const month = `${parsed.m}`.padStart(2, '0');
    const day = `${parsed.d}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const raw = trimOrEmpty(value);
  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw))) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function yesToBoolean(value: unknown) {
  const normalized = trimOrEmpty(value).toLowerCase();
  return normalized === 'yes' || normalized === 'y' || normalized === 'true' || normalized === '1';
}

function toCode(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function getCell(row: unknown[], index: number) {
  if (index < 0 || index >= row.length) {
    return null;
  }

  return row[index];
}

function firstNonEmptyCellText(row: unknown[], indexes: number[]) {
  for (const index of indexes) {
    const value = cellToText(getCell(row, index));
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeHeader(value: unknown) {
  return trimOrEmpty(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[().,:;\/\\]+/g, '')
    .trim();
}

function findHeaderIndex(headers: unknown[], candidates: string[], fallbackIndex: number) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const matchedIndex = normalizedHeaders.findIndex((header) => header === normalizedCandidate);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return fallbackIndex;
}

function findSheetHeaderRowIndex(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 200); rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(cell));

    const hasSupportItemNumber = normalizedRow.includes(normalizeHeader('Support Item Number'));
    const hasSupportItemName = normalizedRow.includes(normalizeHeader('Support Item Name'));
    const hasCategoryNumber = normalizedRow.includes(normalizeHeader('Support Category Number')) || normalizedRow.includes(normalizeHeader('Support Category Number (PACE)'));
    const hasCategoryName = normalizedRow.includes(normalizeHeader('Support Category Name')) || normalizedRow.includes(normalizeHeader('Support Category Name (PACE)'));

    if (hasSupportItemNumber && hasSupportItemName && hasCategoryNumber && hasCategoryName) {
      return rowIndex;
    }
  }

  return -1;
}

async function ensureSchema() {
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
    CREATE UNIQUE INDEX IF NOT EXISTS rate_set_category_unique_active_idx
    ON rate_set_category(rate_set_id, category_number)
    WHERE deleted_at IS NULL
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
    CREATE UNIQUE INDEX IF NOT EXISTS rate_set_support_item_unique_active_idx
    ON rate_set_support_item(rate_set_id, category_id, item_number)
    WHERE deleted_at IS NULL
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_attribute_type (
      code text PRIMARY KEY,
      label text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_attribute (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      support_item_id int NOT NULL REFERENCES rate_set_support_item(id),
      attribute_code text NOT NULL REFERENCES rate_set_support_item_attribute_type(code),
      value boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (support_item_id, attribute_code)
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_type (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code text NOT NULL UNIQUE,
      label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_pricing_region (
      code text PRIMARY KEY,
      label text NOT NULL UNIQUE,
      full_label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz
    )
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS rate_set_support_item_price (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rate_set_id int NOT NULL REFERENCES rate_set(id),
      support_item_id int NOT NULL REFERENCES rate_set_support_item(id),
      type_id int REFERENCES rate_set_support_item_type(id),
      pricing_region_code text REFERENCES rate_set_support_item_pricing_region(code),
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
    CREATE TABLE IF NOT EXISTS gender (
      id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code text NOT NULL UNIQUE,
      label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deactivated_at timestamptz
    )
  `);

  for (const label of GENDERS) {
    const code = toCode(label);
    await dbPool.query(
      `
      INSERT INTO gender (code, label)
      VALUES ($1, $2)
      ON CONFLICT (code) DO NOTHING
      `,
      [code, label],
    );
  }
}

async function createRateSet(name: string, description: string | null, startDate: string, endDate: string | null) {
  const result = await dbPool.query<{ id: number }>(
    `
    INSERT INTO rate_set (name, description, start_date, end_date)
    VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
    RETURNING id
    `,
    [name, description, `${startDate}T00:00:00Z`, endDate ? `${endDate}T23:59:59Z` : null],
  );

  return result.rows[0]?.id ?? null;
}

async function getOrCreateCategory(rateSetId: number, categoryNumber: string, categoryName: string) {
  const existing = await dbPool.query<{ id: number }>(
    `
    SELECT id
    FROM rate_set_category
    WHERE rate_set_id = $1
      AND category_number = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [rateSetId, categoryNumber],
  );

  if (existing.rows[0]) {
    await dbPool.query(
      `
      UPDATE rate_set_category
      SET category_name = $1, updated_at = now()
      WHERE id = $2
      `,
      [categoryName, existing.rows[0].id],
    );

    return existing.rows[0].id;
  }

  const inserted = await dbPool.query<{ id: number }>(
    `
    INSERT INTO rate_set_category (rate_set_id, category_number, category_name)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [rateSetId, categoryNumber, categoryName],
  );

  return inserted.rows[0]?.id ?? null;
}

async function getOrCreateSupportItem(
  rateSetId: number,
  categoryId: number,
  itemNumber: string,
  itemName: string,
  unit: string | null,
) {
  const existing = await dbPool.query<{ id: number }>(
    `
    SELECT id
    FROM rate_set_support_item
    WHERE rate_set_id = $1
      AND category_id = $2
      AND item_number = $3
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [rateSetId, categoryId, itemNumber],
  );

  if (existing.rows[0]) {
    await dbPool.query(
      `
      UPDATE rate_set_support_item
      SET item_name = $1,
          unit = $2,
          updated_at = now()
      WHERE id = $3
      `,
      [itemName, unit, existing.rows[0].id],
    );

    return existing.rows[0].id;
  }

  const inserted = await dbPool.query<{ id: number }>(
    `
    INSERT INTO rate_set_support_item (rate_set_id, category_id, item_number, item_name, unit)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [rateSetId, categoryId, itemNumber, itemName, unit],
  );

  return inserted.rows[0]?.id ?? null;
}

async function upsertAttributeType(code: string, label: string) {
  await dbPool.query(
    `
    INSERT INTO rate_set_support_item_attribute_type (code, label)
    VALUES ($1, $2)
    ON CONFLICT (code)
    DO UPDATE SET label = EXCLUDED.label
    `,
    [code, label],
  );
}

async function upsertSupportItemAttribute(supportItemId: number, attributeCode: string, value: boolean) {
  await dbPool.query(
    `
    INSERT INTO rate_set_support_item_attribute (support_item_id, attribute_code, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (support_item_id, attribute_code)
    DO UPDATE SET value = EXCLUDED.value
    `,
    [supportItemId, attributeCode, value],
  );
}

async function getOrCreateSupportItemType(labelRaw: unknown) {
  const label = trimOrEmpty(labelRaw);
  if (!label) {
    return null;
  }

  const code = toCode(label);

  const existing = await dbPool.query<{ id: number }>(
    `SELECT id FROM rate_set_support_item_type WHERE code = $1 LIMIT 1`,
    [code],
  );

  if (existing.rows[0]) {
    await dbPool.query(
      `UPDATE rate_set_support_item_type SET label = $1 WHERE id = $2`,
      [label, existing.rows[0].id],
    );

    return existing.rows[0].id;
  }

  const inserted = await dbPool.query<{ id: number }>(
    `INSERT INTO rate_set_support_item_type (code, label) VALUES ($1, $2) RETURNING id`,
    [code, label],
  );

  return inserted.rows[0]?.id ?? null;
}

async function upsertPricingRegion(code: string, label: string, fullLabel: string) {
  await dbPool.query(
    `
    INSERT INTO rate_set_support_item_pricing_region (code, label, full_label)
    VALUES ($1, $2, $3)
    ON CONFLICT (code)
    DO UPDATE SET label = EXCLUDED.label, full_label = EXCLUDED.full_label
    `,
    [code, label, fullLabel],
  );
}

async function upsertPrice(
  rateSetId: number,
  supportItemId: number,
  typeId: number | null,
  pricingRegionCode: string,
  unitPrice: number,
  startDate: string,
  endDate: string | null,
) {
  await dbPool.query(
    `
    INSERT INTO rate_set_support_item_price (
      rate_set_id,
      support_item_id,
      type_id,
      pricing_region_code,
      unit_price,
      start_date,
      end_date
    )
    VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
    ON CONFLICT (
      rate_set_id,
      support_item_id,
      type_id,
      pricing_region_code,
      start_date,
      end_date
    )
    DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = now()
    `,
    [
      rateSetId,
      supportItemId,
      typeId,
      pricingRegionCode,
      unitPrice,
      `${startDate}T00:00:00Z`,
      endDate ? `${endDate}T23:59:59Z` : null,
    ],
  );
}

async function updateSorting(rateSetId: number) {
  await dbPool.query(
    `
    UPDATE rate_set_category c
    SET sorting = ranked.rn,
        updated_at = now()
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          ORDER BY
            NULLIF(regexp_replace(category_number, '[^0-9]', '', 'g'), '')::numeric NULLS LAST,
            category_number,
            id
        ) AS rn
      FROM rate_set_category
      WHERE rate_set_id = $1
        AND deleted_at IS NULL
    ) ranked
    WHERE c.id = ranked.id
    `,
    [rateSetId],
  );

  await dbPool.query(
    `
    UPDATE rate_set_support_item si
    SET sorting = ranked.rn,
        updated_at = now()
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY rate_set_id
          ORDER BY
            NULLIF(regexp_replace(item_number, '[^0-9]', '', 'g'), '')::numeric NULLS LAST,
            item_number,
            id
        ) AS rn
      FROM rate_set_support_item
      WHERE rate_set_id = $1
        AND deleted_at IS NULL
    ) ranked
    WHERE si.id = ranked.id
    `,
    [rateSetId],
  );
}

async function processWorkbook(file: File, rateSetId: number, defaultStartDate: string) {
  const warnings: string[] = [];
  let importedRows = 0;

  const workbookBuffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
    });

    if (rawRows.length < 2) {
      continue;
    }

    const headerRowIndex = findSheetHeaderRowIndex(rawRows);
    if (headerRowIndex < 0) {
      warnings.push(`Sheet ${sheetName}: header row not found.`);
      continue;
    }

    const headerRow = rawRows[headerRowIndex] ?? [];

    const columnIndexes = {
      itemNumber: findHeaderIndex(headerRow, ['Support Item Number'], 0),
      itemName: findHeaderIndex(headerRow, ['Support Item Name'], 1),
      categoryNumberPrimary: findHeaderIndex(headerRow, ['Support Category Number'], 4),
      categoryNumberPace: findHeaderIndex(headerRow, ['Support Category Number (PACE)'], 5),
      categoryNamePrimary: findHeaderIndex(headerRow, ['Support Category Name'], 6),
      categoryNamePace: findHeaderIndex(headerRow, ['Support Category Name (PACE)'], 7),
      categoryNumber: findHeaderIndex(headerRow, ['Support Category Number (PACE)', 'Support Category Number'], 5),
      categoryName: findHeaderIndex(headerRow, ['Support Category Name (PACE)', 'Support Category Name'], 7),
      unit: findHeaderIndex(headerRow, ['Unit'], 8),
      quote: findHeaderIndex(headerRow, ['Quote'], 9),
      startDate: findHeaderIndex(headerRow, ['Start date', 'Start Date'], 10),
      endDate: findHeaderIndex(headerRow, ['End Date', 'End date'], 11),
      type: findHeaderIndex(headerRow, ['Type'], 27),
    };

    let currentCategoryNumber = '';
    let currentCategoryName = '';

    const attributeColumns = ATTRIBUTE_COLUMNS.map((attribute) => {
      const index = findHeaderIndex(headerRow, attribute.headerCandidates, attribute.fallbackIndex);
      const headerLabel = trimOrEmpty(getCell(headerRow, index)) || attribute.code;

      return {
        columnIndex: index,
        code: attribute.code,
        label: headerLabel,
      };
    });

    for (const attribute of attributeColumns) {
      await upsertAttributeType(attribute.code, attribute.label);
    }

    const regionColumns = REGION_COLUMNS.map((region) => {
      const index = findHeaderIndex(headerRow, region.headerCandidates, region.fallbackIndex);
      const headerLabel = trimOrEmpty(getCell(headerRow, index));
      const label = headerLabel || toCode(region.fullLabel).replaceAll('_', ' ');
      const code = toCode(label);

      return {
        columnIndex: index,
        code,
        label,
        fullLabel: region.fullLabel,
      };
    });

    for (const region of regionColumns) {
      await upsertPricingRegion(region.code, region.label, region.fullLabel);
    }

    let importedRowsForSheet = 0;

    for (let i = headerRowIndex + 1; i < rawRows.length; i += 1) {
      const row = rawRows[i];

      if (!Array.isArray(row)) {
        continue;
      }

      const itemNumber = cellToText(getCell(row, columnIndexes.itemNumber));
      const itemName = cellToText(getCell(row, columnIndexes.itemName));
      const rawCategoryNumber = firstNonEmptyCellText(row, [columnIndexes.categoryNumberPace, columnIndexes.categoryNumberPrimary, columnIndexes.categoryNumber]);
      const rawCategoryName = firstNonEmptyCellText(row, [columnIndexes.categoryNamePace, columnIndexes.categoryNamePrimary, columnIndexes.categoryName]);
      const categoryNumber = rawCategoryNumber || currentCategoryNumber;
      const categoryName = rawCategoryName || currentCategoryName;
      const unit = cellToText(getCell(row, columnIndexes.unit)) || null;
      const startDate = normalizeDate(getCell(row, columnIndexes.startDate)) || defaultStartDate;
      const endDate = normalizeDate(getCell(row, columnIndexes.endDate));
      const supportTypeLabel = cellToText(getCell(row, columnIndexes.type));

      if (!categoryNumber || !categoryName) {
        continue;
      }

      if (rawCategoryNumber) {
        currentCategoryNumber = rawCategoryNumber;
      }

      if (rawCategoryName) {
        currentCategoryName = rawCategoryName;
      }

      if (!itemNumber || !itemName) {
        continue;
      }

      const categoryId = await getOrCreateCategory(rateSetId, categoryNumber, categoryName);
      if (!categoryId) {
        warnings.push(`Sheet ${sheetName} row ${i + 1}: failed to resolve category.`);
        continue;
      }

      const supportItemId = await getOrCreateSupportItem(rateSetId, categoryId, itemNumber, itemName, unit);
      if (!supportItemId) {
        warnings.push(`Sheet ${sheetName} row ${i + 1}: failed to resolve support item.`);
        continue;
      }

      for (const attribute of attributeColumns) {
        const attrValue = getCell(row, attribute.columnIndex);
        await upsertSupportItemAttribute(supportItemId, attribute.code, yesToBoolean(attrValue));
      }

      const typeId = await getOrCreateSupportItemType(supportTypeLabel);

      for (const region of regionColumns) {
        const unitPriceCell = getCell(row, region.columnIndex);
        const unitPrice = toNumberOrNull(unitPriceCell);

        if (unitPrice === null) {
          continue;
        }

        await upsertPrice(rateSetId, supportItemId, typeId, region.code, round2(unitPrice), startDate, endDate);
      }

      importedRows += 1;
      importedRowsForSheet += 1;
    }

    if (importedRowsForSheet === 0) {
      warnings.push(`Sheet ${sheetName}: no importable rows found after parsing.`);
    }
  }

  await updateSorting(rateSetId);

  return {
    importedRows,
    warnings,
  };
}

async function listRateSets(): Promise<RateSetRow[]> {
  const result = await dbPool.query<RateSetRow>(
    `
    SELECT
      rs.id,
      rs.name,
      rs.description,
      rs.start_date::text AS start_date,
      rs.end_date::text AS end_date,
      rs.created_at::text AS created_at,
      COALESCE(category_counts.category_count, 0)::int AS category_count,
      COALESCE(item_counts.support_item_count, 0)::int AS support_item_count,
      COALESCE(price_counts.price_count, 0)::int AS price_count
    FROM rate_set rs
    LEFT JOIN (
      SELECT rate_set_id, COUNT(*)::int AS category_count
      FROM rate_set_category
      WHERE deleted_at IS NULL
      GROUP BY rate_set_id
    ) category_counts ON category_counts.rate_set_id = rs.id
    LEFT JOIN (
      SELECT rate_set_id, COUNT(*)::int AS support_item_count
      FROM rate_set_support_item
      WHERE deleted_at IS NULL
      GROUP BY rate_set_id
    ) item_counts ON item_counts.rate_set_id = rs.id
    LEFT JOIN (
      SELECT rate_set_id, COUNT(*)::int AS price_count
      FROM rate_set_support_item_price
      GROUP BY rate_set_id
    ) price_counts ON price_counts.rate_set_id = rs.id
    WHERE rs.deleted_at IS NULL
    ORDER BY rs.created_at DESC
    `,
  );

  return result.rows;
}

async function getRateSetDetail(rateSetId: number) {
  const [rateSetResult, categoriesResult, supportItemsResult, pricesResult] = await Promise.all([
    dbPool.query<RateSetRow>(
      `
      SELECT
        rs.id,
        rs.name,
        rs.description,
        rs.start_date::text AS start_date,
        rs.end_date::text AS end_date,
        rs.created_at::text AS created_at,
        COALESCE(category_counts.category_count, 0)::int AS category_count,
        COALESCE(item_counts.support_item_count, 0)::int AS support_item_count,
        COALESCE(price_counts.price_count, 0)::int AS price_count
      FROM rate_set rs
      LEFT JOIN (
        SELECT rate_set_id, COUNT(*)::int AS category_count
        FROM rate_set_category
        WHERE deleted_at IS NULL
        GROUP BY rate_set_id
      ) category_counts ON category_counts.rate_set_id = rs.id
      LEFT JOIN (
        SELECT rate_set_id, COUNT(*)::int AS support_item_count
        FROM rate_set_support_item
        WHERE deleted_at IS NULL
        GROUP BY rate_set_id
      ) item_counts ON item_counts.rate_set_id = rs.id
      LEFT JOIN (
        SELECT rate_set_id, COUNT(*)::int AS price_count
        FROM rate_set_support_item_price
        GROUP BY rate_set_id
      ) price_counts ON price_counts.rate_set_id = rs.id
      WHERE rs.id = $1
        AND rs.deleted_at IS NULL
      `,
      [rateSetId],
    ),
    dbPool.query<RateSetCategoryRow>(
      `
      SELECT id, rate_set_id, category_number, category_name, sorting
      FROM rate_set_category
      WHERE rate_set_id = $1
        AND deleted_at IS NULL
      ORDER BY sorting, id
      `,
      [rateSetId],
    ),
    dbPool.query<RateSetSupportItemRow>(
      `
      SELECT id, rate_set_id, category_id, item_number, item_name, unit, sorting
      FROM rate_set_support_item
      WHERE rate_set_id = $1
        AND deleted_at IS NULL
      ORDER BY sorting, id
      `,
      [rateSetId],
    ),
    dbPool.query<RateSetSupportItemPriceRow>(
      `
      SELECT id, rate_set_id, support_item_id, type_id, pricing_region_code, unit_price::text AS unit_price, start_date::text AS start_date, end_date::text AS end_date
      FROM rate_set_support_item_price
      WHERE rate_set_id = $1
      ORDER BY support_item_id, pricing_region_code, start_date
      `,
      [rateSetId],
    ),
  ]);

  const rateSet = rateSetResult.rows[0];
  if (!rateSet) {
    return null;
  }

  return {
    rate_set: rateSet,
    categories: categoriesResult.rows,
    support_items: supportItemsResult.rows,
    prices: pricesResult.rows,
  };
}

function validateRateSetPayload(payload: RateSetPayload) {
  const errors: Record<string, string> = {};

  const name = trimOrEmpty(payload.name);
  const description = trimOrEmpty(payload.description) || null;
  const startDate = normalizeDate(payload.start_date);
  const endDate = normalizeDate(payload.end_date);

  if (!name) {
    errors.name = 'name is required.';
  }

  if (!startDate) {
    errors.start_date = 'start_date is required.';
  }

  if (startDate && endDate && startDate > endDate) {
    errors.end_date = 'end_date must be greater than or equal to start_date.';
  }

  return {
    errors,
    values: {
      name,
      description,
      start_date: startDate,
      end_date: endDate,
    },
  };
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    await ensureSchema();

    const requestUrl = new URL(request.url);
    const idParam = requestUrl.searchParams.get('id');

    if (idParam) {
      const rateSetId = Number(idParam);
      if (!Number.isInteger(rateSetId) || rateSetId <= 0) {
        return NextResponse.json({ error: 'A valid rate_set id is required.' }, { status: 400 });
      }

      const detail = await getRateSetDetail(rateSetId);
      if (!detail) {
        return NextResponse.json({ error: 'Rate set not found.' }, { status: 404 });
      }

      return NextResponse.json(detail, { status: 200 });
    }

    return NextResponse.json({ rate_sets: await listRateSets() }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to load rate sets.' }, { status: 500 });
  }
}

function toErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unknown error';
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    await ensureSchema();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Excel file is required.' }, { status: 400 });
      }

      const fileName = file.name.replace(/\.[^.]+$/, '');
      const rateSetName = trimOrEmpty(formData.get('name')) || fileName || `NDIS Import ${new Date().toISOString()}`;
      const rateSetDescription = trimOrEmpty(formData.get('description')) || `Imported from Excel file: ${file.name}`;

      const today = new Date();
      const todayString = `${today.getUTCFullYear()}-${`${today.getUTCMonth() + 1}`.padStart(2, '0')}-${`${today.getUTCDate()}`.padStart(2, '0')}`;
      const requestedStartDate = normalizeDate(formData.get('start_date')) || todayString;
      const requestedEndDate = normalizeDate(formData.get('end_date'));

      const rateSetId = await createRateSet(rateSetName, rateSetDescription, requestedStartDate, requestedEndDate);
      if (!rateSetId) {
        return NextResponse.json({ error: 'Failed to create rate_set for import.' }, { status: 500 });
      }

      const importResult = await processWorkbook(file, rateSetId, requestedStartDate);

      return NextResponse.json(
        {
          id: rateSetId,
          importedRows: importResult.importedRows,
          warnings: importResult.warnings,
        },
        { status: 200 },
      );
    }

    const payload = (await request.json()) as RateSetPayload;
    const validation = validateRateSetPayload(payload);

    if (Object.keys(validation.errors).length > 0) {
      return NextResponse.json({ error: 'Validation failed.', details: validation.errors }, { status: 400 });
    }

    const rateSetId = await createRateSet(
      validation.values.name,
      validation.values.description,
      validation.values.start_date as string,
      validation.values.end_date,
    );

    if (!rateSetId) {
      return NextResponse.json({ error: 'Failed to create rate set.' }, { status: 500 });
    }

    return NextResponse.json({ id: rateSetId }, { status: 201 });
  } catch (error) {
    const message = toErrorMessage(error);
    return NextResponse.json({ error: `Failed to save rate set. ${message}` }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const rateSetId = Number(idParam);

  if (!idParam || !Number.isInteger(rateSetId) || rateSetId <= 0) {
    return NextResponse.json({ error: 'A valid rate_set id is required.' }, { status: 400 });
  }

  try {
    await ensureSchema();

    const existing = await dbPool.query<{ id: number }>(
      `SELECT id FROM rate_set WHERE id = $1 AND deleted_at IS NULL`,
      [rateSetId],
    );

    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Rate set not found.' }, { status: 404 });
    }

    const payload = (await request.json()) as RateSetPayload;
    const validation = validateRateSetPayload(payload);

    if (Object.keys(validation.errors).length > 0) {
      return NextResponse.json({ error: 'Validation failed.', details: validation.errors }, { status: 400 });
    }

    await dbPool.query(
      `
      UPDATE rate_set
      SET
        name = $1,
        description = $2,
        start_date = $3::timestamptz,
        end_date = $4::timestamptz,
        updated_at = now()
      WHERE id = $5
      `,
      [
        validation.values.name,
        validation.values.description,
        `${validation.values.start_date}T00:00:00Z`,
        validation.values.end_date ? `${validation.values.end_date}T23:59:59Z` : null,
        rateSetId,
      ],
    );

    return NextResponse.json({ id: rateSetId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to update rate set.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get('id');
  const rateSetId = Number(idParam);

  if (!idParam || !Number.isInteger(rateSetId) || rateSetId <= 0) {
    return NextResponse.json({ error: 'A valid rate_set id is required.' }, { status: 400 });
  }

  try {
    await ensureSchema();

    const existing = await dbPool.query<{ id: number }>(
      `SELECT id FROM rate_set WHERE id = $1 AND deleted_at IS NULL`,
      [rateSetId],
    );

    if (!existing.rows[0]) {
      return NextResponse.json({ error: 'Rate set not found.' }, { status: 404 });
    }

    await dbPool.query(`UPDATE rate_set_support_item_price SET updated_at = now() WHERE rate_set_id = $1`, [rateSetId]);
    await dbPool.query(`UPDATE rate_set_support_item SET deleted_at = now(), updated_at = now() WHERE rate_set_id = $1 AND deleted_at IS NULL`, [rateSetId]);
    await dbPool.query(`UPDATE rate_set_category SET deleted_at = now(), updated_at = now() WHERE rate_set_id = $1 AND deleted_at IS NULL`, [rateSetId]);
    await dbPool.query(`UPDATE rate_set SET deleted_at = now(), updated_at = now() WHERE id = $1`, [rateSetId]);

    return NextResponse.json({ id: rateSetId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete rate set.' }, { status: 500 });
  }
}
