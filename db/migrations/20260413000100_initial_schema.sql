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
);

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
);

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS abn VARCHAR(11);

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(16);

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS unit_building TEXT;

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS providers_abn_active_idx
ON providers (abn)
WHERE deleted_at IS NULL
  AND abn IS NOT NULL;

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
);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_set_category_unique_active_idx
ON rate_set_category(rate_set_id, category_number)
WHERE deleted_at IS NULL;

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
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_set_support_item_unique_active_idx
ON rate_set_support_item(rate_set_id, category_id, item_number)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rate_set_support_item_attribute_type (
  code text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

CREATE TABLE IF NOT EXISTS rate_set_support_item_attribute (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  support_item_id int NOT NULL REFERENCES rate_set_support_item(id),
  attribute_code text NOT NULL REFERENCES rate_set_support_item_attribute_type(code),
  value boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (support_item_id, attribute_code)
);

CREATE TABLE IF NOT EXISTS rate_set_support_item_type (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

CREATE TABLE IF NOT EXISTS rate_set_support_item_pricing_region (
  code text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  full_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

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
);

CREATE TABLE IF NOT EXISTS gender (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

INSERT INTO gender (code, label)
VALUES
  ('FEMALE', 'Female'),
  ('MALE', 'Male'),
  ('UNIDENTIFIED', 'Unidentified')
ON CONFLICT (code) DO NOTHING;

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
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_number_active_idx
ON invoices (provider_id, invoice_number)
WHERE deleted_at IS NULL;

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
);
