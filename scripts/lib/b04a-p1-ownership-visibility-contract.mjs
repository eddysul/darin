export const B04A_P1_FUNCTION_SIGNATURES = [
  "public.current_baby_write_permission(uuid)",
  "public.can_manage_care_log(uuid)",
  "public.care_log_identity_unchanged(uuid,uuid,uuid)",
  "public.can_manage_growth_record(uuid)",
  "public.growth_record_identity_unchanged(uuid,uuid,uuid)",
  "public.can_manage_diary_entry(uuid)",
  "public.can_manage_memory_post(uuid)",
  "public.can_delete_memory_post(uuid)",
  "public.is_current_memory_friend_for_write(uuid)",
  "public.is_active_family_tag_recipient(uuid,uuid)",
  "public.is_active_selected_memory_recipient(uuid,uuid)",
  "public.can_view_memory_post(uuid)",
  "public.can_interact_with_memory_post(uuid)",
  "public.can_assign_memory_recipient_for_write(uuid,uuid,boolean)",
];

export const B04A_P1_POLICIES = [
  ["care_logs", "care_logs_insert_editor"],
  ["care_logs", "care_logs_update_editor"],
  ["care_logs", "care_logs_delete_editor"],
  ["growth_records", "growth_records_insert_editor"],
  ["growth_records", "growth_records_update_editor"],
  ["growth_records", "growth_records_delete_editor"],
  ["diary_entries", "diary_entries_insert_admin_editor"],
  ["diary_entries", "diary_entries_update_author_admin"],
  ["memory_posts", "memory_posts_insert_editor"],
  ["memory_posts", "memory_posts_select_visible"],
  ["memory_posts", "memory_posts_update_author_or_admin"],
  ["memory_posts", "memory_posts_delete_author_or_admin"],
  ["memory_tags", "memory_tags_select_visible"],
  ["memory_tags", "memory_tags_insert_manager"],
  ["memory_selected_people", "memory_selected_people_insert_manager"],
  ["memory_comments", "memory_comments_insert_member"],
  ["memory_comments", "memory_comments_update_author"],
  ["memory_comments", "memory_comments_delete_author_or_post_owner"],
  ["memory_reactions", "memory_reactions_insert_member"],
  ["memory_reactions", "memory_reactions_update_author"],
  ["memory_reactions", "memory_reactions_delete_author"],
];

const functionRegprocedures = B04A_P1_FUNCTION_SIGNATURES
  .map((signature) => `'${signature}'::regprocedure`)
  .join(",");
const policyPredicates = B04A_P1_POLICIES
  .map(([table, policy]) => `(tablename='${table}' and policyname='${policy}')`)
  .join(" or ");
const normalizePolicyExpression = (column) => `regexp_replace(
        regexp_replace(
          coalesce(${column}, ''),
          $$('(?:[^']|'')*')::[a-zA-Z_][a-zA-Z0-9_.]*(\\[\\])?$$,
          E'\\\\1',
          'g'
        ),
        $$\\(([a-zA-Z_][a-zA-Z0-9_]*\\.status)\\)::text$$,
        E'\\\\1',
        'g'
      )`;
const policyContractRow = `concat_ws('|',
      schemaname, tablename, policyname, permissive, array_to_string(roles, ','), cmd,
      ${normalizePolicyExpression("qual")},
      ${normalizePolicyExpression("with_check")}
    )`;

export const B04A_P1_FUNCTION_CONTRACT_SQL = `
  select count(*)::text || '|' || encode(digest(string_agg(contract_row, E'\\n' order by contract_row), 'sha256'), 'hex')
  from (
    select concat_ws('|',
      procedure_row.oid::regprocedure::text,
      pg_get_functiondef(procedure_row.oid),
      procedure_row.prosecdef::text,
      coalesce(array_to_string(procedure_row.proconfig, ','), ''),
      has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')::text,
      has_function_privilege('anon', procedure_row.oid, 'EXECUTE')::text
    ) as contract_row
    from pg_proc as procedure_row
    where procedure_row.oid in (${functionRegprocedures})
  ) as function_contract`;

export const B04A_P1_POLICY_CONTRACT_SQL = `
  select count(*)::text || '|' || encode(digest(string_agg(contract_row, E'\\n' order by contract_row), 'sha256'), 'hex')
  from (
    select ${policyContractRow} as contract_row
    from pg_policies
    where schemaname='public' and (${policyPredicates})
  ) as policy_contract`;

export const B04A_P1_POLICY_ROW_CONTRACT_SQL = `
  select tablename || '|' || policyname || '|' || encode(digest(${policyContractRow}, 'sha256'), 'hex')
  from pg_policies
  where schemaname='public' and (${policyPredicates})
  order by tablename, policyname`;

export const B04A_P1_POLICY_DIAGNOSTIC_SQL = `
  select tablename || '|' || policyname || '|QUAL=' || coalesce(qual, '') || '|CHECK=' || coalesce(with_check, '')
  from pg_policies
  where schemaname='public' and policyname in (
    'memory_tags_insert_manager',
    'memory_selected_people_insert_manager'
  )
  order by tablename, policyname`;

// The policy hash normalizes PostgreSQL's environment-dependent cast on quoted
// literals and the redundant `.status::text` wrapper retained only when the
// deployed column is an enum. Other column casts, operators, predicates, roles,
// and commands remain exact and are asserted by apply tooling.
export const B04A_P1_EXPECTED_FUNCTION_CONTRACT =
  "14|1410fdad5164b7c45114e7f214f1ec3fd188d464ac17287a0e0a7aacc114a83f";
export const B04A_P1_EXPECTED_POLICY_CONTRACT =
  "21|00cc9488838d5a1fe238c078853e4d03ae371dd6e0e140e7b2e05f23e7ab86e5";
