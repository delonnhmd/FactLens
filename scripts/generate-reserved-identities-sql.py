from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "supabase" / "imports" / "reserved-identities"
OUTPUT_PATH = IMPORT_ROOT / "generated" / "import_reserved_identities.sql"
SYSTEM_USERNAMES_PATH = IMPORT_ROOT / "people" / "reserved_system_usernames.txt"


def normalize_identity_key(value: object) -> str:
    return re.sub(r"[\s_.-]+", "", str(value or "").strip().lower())


def clean_string(value: object) -> str:
    if value is None or pd.isna(value):
        return ""

    return str(value).strip()


def sql_string(value: object) -> str:
    text = clean_string(value)

    if not text:
        return "null"

    return "'" + text.replace("'", "''") + "'"


def tuple_lines(rows: Iterable[dict], fields: list[str]) -> list[str]:
    return [
        "(" + ", ".join(sql_string(row.get(field)) for field in fields) + ")"
        for row in rows
    ]


def read_people_rows() -> list[dict]:
    path = IMPORT_ROOT / "people" / "reserved_usernames_list.xlsx"
    dataframe = pd.read_excel(path, sheet_name="Master Clean List", dtype=str)
    rows_by_key: dict[str, dict] = {}

    for _, row in dataframe.iterrows():
        display_name = clean_string(row.get("Display Name"))
        category = clean_string(row.get("Source Tab Category"))
        normalized_key = normalize_identity_key(
            clean_string(row.get("Normalized Value (No Spaces/Lowercase)")) or display_name
        )

        if not display_name or not normalized_key:
            continue

        rows_by_key[normalized_key] = {
            "display_name": display_name,
            "normalized_key": normalized_key,
            "category": category,
            "source_import": "reserved_usernames_list.xlsx:Master Clean List",
        }

    if SYSTEM_USERNAMES_PATH.exists():
        for line in SYSTEM_USERNAMES_PATH.read_text(encoding="utf-8").splitlines():
            display_name = clean_string(line)
            normalized_key = normalize_identity_key(display_name)

            if not display_name or not normalized_key or normalized_key in rows_by_key:
                continue

            rows_by_key[normalized_key] = {
                "display_name": display_name,
                "normalized_key": normalized_key,
                "category": "System Reserved Usernames",
                "source_import": "reserved_system_usernames.txt",
            }

    return list(rows_by_key.values())


def read_brand_rows() -> list[dict]:
    rows_by_key: dict[str, dict] = {}
    path = IMPORT_ROOT / "brands" / "reserved_brands_list.xlsx"
    dataframe = pd.read_excel(path, sheet_name="Master Clean Brand List", dtype=str)
    source_import = "reserved_brands_list.xlsx:Master Clean Brand List"

    for _, row in dataframe.iterrows():
        brand_name = clean_string(row.get("Brand Display Name"))
        industry = clean_string(row.get("Source Industry Tab"))
        normalized_key = normalize_identity_key(clean_string(row.get("Normalized Key Value")) or brand_name)

        if not brand_name or not normalized_key:
            continue

        rows_by_key[normalized_key] = {
            "brand_name": brand_name,
            "normalized_key": normalized_key,
            "industry": industry,
            "website": "",
            "source_import": source_import,
        }

    return list(rows_by_key.values())


def read_organization_rows() -> list[dict]:
    path = IMPORT_ROOT / "organizations" / "reserved_organizations_list.xlsx"
    dataframe = pd.read_excel(path, sheet_name="Master Clean Org List", dtype=str)
    rows_by_key: dict[str, dict] = {}
    source_import = "reserved_organizations_list.xlsx:Master Clean Org List"

    for _, row in dataframe.iterrows():
        organization_name = clean_string(row.get("Organization Display Name"))
        industry = clean_string(row.get("Source Category Tab"))
        normalized_key = normalize_identity_key(clean_string(row.get("Normalized Key Token")) or organization_name)

        if not organization_name or not normalized_key:
            continue

        rows_by_key[normalized_key] = {
            "brand_name": organization_name,
            "normalized_key": normalized_key,
            "industry": industry,
            "website": "",
            "source_import": source_import,
        }

    return list(rows_by_key.values())


def build_dynamic_upsert_block(
    table_name: str,
    temp_table_name: str,
    required_columns: list[str],
    optional_columns: list[tuple[str, str, bool]],
) -> str:
    lines = [
        "do $$",
        "declare",
        f"  insert_cols text[] := array[{', '.join(sql_string(column) for column in required_columns)}];",
        f"  select_exprs text[] := array[{', '.join(sql_string(column) for column in required_columns)}];",
        "  update_exprs text[] := array[",
        ",\n".join(f"    {sql_string(column + ' = excluded.' + column)}" for column in required_columns if column != "normalized_key"),
        "  ];",
        "begin",
    ]

    for target_column, source_expression, update_on_conflict in optional_columns:
        lines.extend([
            "  if exists (",
            "    select 1 from information_schema.columns",
            f"    where table_schema = 'public' and table_name = {sql_string(table_name)} and column_name = {sql_string(target_column)}",
            "  ) then",
            f"    insert_cols := array_append(insert_cols, {sql_string(target_column)});",
            f"    select_exprs := array_append(select_exprs, {sql_string(source_expression)});",
        ])

        if update_on_conflict:
            lines.append(f"    update_exprs := array_append(update_exprs, {sql_string(target_column + ' = excluded.' + target_column)});")

        lines.append("  end if;")

    lines.extend([
        "  execute format(",
        "    'insert into public.%I (%s) select %s from %I on conflict (normalized_key) do update set %s',",
        f"    {sql_string(table_name)},",
        "    array_to_string(array(select quote_ident(column_name) from unnest(insert_cols) as column_name), ', '),",
        "    array_to_string(select_exprs, ', '),",
        f"    {sql_string(temp_table_name)},",
        "    array_to_string(update_exprs, ', ')",
        "  );",
        "end $$;",
    ])

    return "\n".join(lines)


def build_reserved_brands_upsert_block(temp_table_name: str) -> str:
    return build_dynamic_upsert_block(
        "reserved_brands",
        temp_table_name,
        ["brand_name", "normalized_key", "industry"],
        [
            ("active", "active", True),
            ("source_import", "source_import", True),
            ("website", "website", True),
            ("created_at", "created_at", False),
            ("updated_at", "updated_at", True),
        ],
    )


def build_sql(people_rows: list[dict], brand_rows: list[dict], organization_rows: list[dict]) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    people_values = ",\n".join(tuple_lines(people_rows, ["display_name", "normalized_key", "category", "source_import"]))
    brand_values = ",\n".join(tuple_lines(brand_rows, ["brand_name", "normalized_key", "industry", "website", "source_import"]))
    organization_values = ",\n".join(
        tuple_lines(
            organization_rows,
            ["brand_name", "normalized_key", "industry", "website", "source_import"],
        )
    )

    return f"""-- Generated reserved identity import.
-- Generated at: {generated_at}
-- Source folder: {IMPORT_ROOT}
-- Run this in the Supabase SQL Editor for the FactLens project.

begin;

create temp table import_reserved_people (
  display_name text,
  normalized_key text primary key,
  category text,
  source_import text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
) on commit drop;

insert into import_reserved_people (display_name, normalized_key, category, source_import)
values
{people_values};

{build_dynamic_upsert_block(
    "reserved_people",
    "import_reserved_people",
    ["display_name", "normalized_key", "category"],
    [
        ("active", "active", True),
        ("source_import", "source_import", True),
        ("created_at", "created_at", False),
        ("updated_at", "updated_at", True),
    ],
)}

create temp table import_reserved_brands (
  brand_name text,
  normalized_key text primary key,
  industry text,
  website text,
  source_import text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
) on commit drop;

insert into import_reserved_brands (brand_name, normalized_key, industry, website, source_import)
values
{brand_values};

{build_reserved_brands_upsert_block("import_reserved_brands")}

-- Organizations are imported into reserved_brands because username checks use reserved_people and reserved_brands.
create temp table import_reserved_organizations (
  brand_name text,
  normalized_key text primary key,
  industry text,
  website text,
  source_import text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
) on commit drop;

insert into import_reserved_organizations (brand_name, normalized_key, industry, website, source_import)
values
{organization_values};

{build_reserved_brands_upsert_block("import_reserved_organizations")}

notify pgrst, 'reload schema';

commit;
"""


def main() -> None:
    people_rows = read_people_rows()
    brand_rows = read_brand_rows()
    organization_rows = read_organization_rows()

    if not people_rows:
        raise RuntimeError("No people rows found.")

    if not brand_rows:
        raise RuntimeError("No brand rows found.")

    if not organization_rows:
        raise RuntimeError("No organization rows found.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(build_sql(people_rows, brand_rows, organization_rows), encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH}")
    print(f"People rows: {len(people_rows)}")
    print(f"Brand rows: {len(brand_rows)}")
    print(f"Organization rows: {len(organization_rows)}")


if __name__ == "__main__":
    main()
