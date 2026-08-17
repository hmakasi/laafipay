-- ============================================================================
-- LaafiPay — Seed multi-pays (Burkina Faso / Bénin / RDC) + Row Level Security
-- ============================================================================
-- Convention de nommage : ce script utilise des noms de table au PLURIEL
-- (countries, tax_rule_sets, tax_brackets, ...), conformément à la demande et
-- à l'usage courant chez Supabase/PostgREST. La note d'architecture précédente
-- utilisait le singulier (country, tax_rule_set, ...) — adapter si le schéma
-- réellement déployé diffère.
--
-- Idempotence : chaque bloc pays est un DO $$ ... $$ qui upsert le
-- tax_rule_set / social_contribution_scheme concerné puis DELETE + INSERT ses
-- lignes filles. Ré-exécuter ce script ne duplique donc rien. On évite
-- volontairement les "ON CONFLICT (tax_rule_set_id, sequence, category_code)"
-- sur tax_brackets/family_quotient_rules : category_code et marital_status y
-- sont NULLables, et Postgres ne considère jamais deux NULL comme en conflit
-- sur une contrainte UNIQUE — un ON CONFLICT y échouerait silencieusement à
-- empêcher les doublons en cas de ré-exécution.
--
-- ⚠️ VALEURS FISCALES : tous les taux, plafonds et bornes de tranches ci-dessous
-- sont des valeurs standards/illustratives destinées à faire fonctionner le
-- moteur de bout en bout. Chaque bloc pays indique explicitement le niveau de
-- confiance et ce qui doit être vérifié avant publication en production
-- (DGI Burkina Faso, DGID Bénin, DGI/INSS/ONEM/INPP RDC).
-- ============================================================================


-- ============================================================================
-- 0. COMPLÉMENTS DE SCHÉMA NÉCESSAIRES À CE SCRIPT
-- ============================================================================
-- Deux tables citées dans la demande RLS (company_users, payroll_entry_line_items)
-- n'étaient pas détaillées dans le schéma précédent : on les crée ici en
-- `IF NOT EXISTS` pour que ce script reste autoportant. Si elles existent déjà
-- avec une définition différente, ces instructions n'ont aucun effet.

create table if not exists company_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  employee_id  uuid references employees(id) on delete set null,
  role         text not null default 'employee'
               check (role in ('admin','hr_manager','manager','accountant','employee')),
  created_at   timestamptz not null default now(),
  unique (user_id, company_id)
);

create table if not exists payroll_entry_line_items (
  id                uuid primary key default gen_random_uuid(),
  payroll_entry_id  uuid not null references payroll_entries(id) on delete cascade,
  type              text not null
                    check (type in ('prime','indemnite','avance','retenue','heures_sup','absence')),
  label             text not null,
  amount            numeric(18,2) not null,
  created_at        timestamptz not null default now()
);

-- La conception initiale de family_quotient_rules (note d'architecture, B.3)
-- faisait varier le barème par catégorie (category_code sur tax_brackets).
-- En seedant les vraies règles BF/RDC, le mécanisme réel s'avère être une
-- RÉDUCTION EN POURCENTAGE appliquée à l'impôt calculé (ex. RDC : -2% par
-- personne à charge). On ajoute donc la colonne manquante plutôt que de
-- forcer les données dans un modèle qui ne les représente pas correctement.
alter table family_quotient_rules
  add column if not exists reduction_rate numeric(5,4) not null default 0;

comment on column family_quotient_rules.reduction_rate is
  'Réduction appliquée à l''impôt calculé : 0.08 = -8% du montant dû. '
  'Combinable avec category_code si un pays a en plus des tranches dédiées.';

-- BF et RDC calculent la réduction uniquement à partir du nombre de personnes
-- à charge, indépendamment de la situation matrimoniale : marital_status doit
-- pouvoir rester NULL ("s'applique à toute situation matrimoniale").
alter table family_quotient_rules alter column marital_status drop not null;


-- ============================================================================
-- PARTIE 1 — DONNÉES INITIALES (SEED DATA)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Référentiel — pays & devises
-- ----------------------------------------------------------------------------
insert into currencies (iso_code, symbol, minor_unit) values
  ('XOF', 'FCFA', 0),
  ('CDF', 'FC',   2),
  ('USD', '$',    2)
on conflict (iso_code) do nothing;

insert into countries (iso_code_2, name, default_currency_id, locale, timezone)
select 'BF', 'Burkina Faso', c.id, 'fr-BF', 'Africa/Ouagadougou'
from currencies c where c.iso_code = 'XOF'
on conflict (iso_code_2) do nothing;

insert into countries (iso_code_2, name, default_currency_id, locale, timezone)
select 'BJ', 'Bénin', c.id, 'fr-BJ', 'Africa/Porto-Novo'
from currencies c where c.iso_code = 'XOF'
on conflict (iso_code_2) do nothing;

insert into countries (iso_code_2, name, default_currency_id, locale, timezone)
select 'CD', 'République Démocratique du Congo', c.id, 'fr-CD', 'Africa/Kinshasa'
from currencies c where c.iso_code = 'CDF'
on conflict (iso_code_2) do nothing;


-- ----------------------------------------------------------------------------
-- 1.2 BURKINA FASO (XOF) — CNSS + IUTS
-- ----------------------------------------------------------------------------
do $$
declare
  v_country_id uuid;
  v_ruleset_id uuid;
  v_scheme_id  uuid;
begin
  select id into v_country_id from countries where iso_code_2 = 'BF';

  -- CNSS : taux fournis par la demande — plafond mensuel 800 000 FCFA.
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'CNSS', 'Caisse Nationale de Sécurité Sociale', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_id;

  delete from social_contribution_rates where scheme_id = v_scheme_id;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_id, 0.0550, 0.1600, 800000, null, date '2024-01-01', null);

  -- IUTS — barème 2022 simplifié (post-réforme), à taux marginaux directs.
  -- `deduction` par tranche calculé pour que (base*rate - deduction) reproduise
  -- une taxation par tranches cumulative correcte, pas juste "rate * base".
  -- ⚠️ Bornes de tranches à recouper avec le texte DGI en vigueur.
  insert into tax_rule_sets (country_id, tax_code, label, version, valid_from, status, published_at)
  values (v_country_id, 'IUTS', 'Barème IUTS Burkina Faso — v1 (illustratif, à valider DGI)',
          1, date '2024-01-01', 'published', now())
  on conflict (country_id, tax_code, version) do update set label = excluded.label
  returning id into v_ruleset_id;

  delete from tax_brackets where tax_rule_set_id = v_ruleset_id;
  insert into tax_brackets (tax_rule_set_id, sequence, min_amount, max_amount, rate, deduction) values
    (v_ruleset_id, 1,      0,  30000, 0.0000,     0),
    (v_ruleset_id, 2,  30001,  50000, 0.1000,  3000),
    (v_ruleset_id, 3,  50001,  80000, 0.1500,  5500),
    (v_ruleset_id, 4,  80001, 120000, 0.2000,  9500),
    (v_ruleset_id, 5, 120001, 170000, 0.2500, 15500),
    (v_ruleset_id, 6, 170001,   null, 0.3000, 24000);

  -- Réduction pour charges de famille : -8%/-10%/-12%/-14% de l'IUTS dû selon
  -- le nombre de personnes à charge (1, 2, 3, 4+). Situation matrimoniale non
  -- discriminante ici (NULL = s'applique à tous les statuts).
  delete from family_quotient_rules where tax_rule_set_id = v_ruleset_id;
  insert into family_quotient_rules
    (tax_rule_set_id, marital_status, dependents_min, dependents_max, category_code, reduction_rate)
  values
    (v_ruleset_id, null, 0,    0, 'CHARGES_0',  0.00),
    (v_ruleset_id, null, 1,    1, 'CHARGES_1',  0.08),
    (v_ruleset_id, null, 2,    2, 'CHARGES_2',  0.10),
    (v_ruleset_id, null, 3,    3, 'CHARGES_3',  0.12),
    (v_ruleset_id, null, 4, null, 'CHARGES_4P', 0.14);
end $$;


-- ----------------------------------------------------------------------------
-- 1.3 BÉNIN (XOF) — CNSS + IRPP
-- ----------------------------------------------------------------------------
-- ⚠️ Confiance plus faible que le bloc BF : le barème IRPP ci-dessous et le
-- mécanisme de réduction familiale sont des hypothèses de travail à faire
-- valider par un expert fiscal béninois / la DGID avant toute publication.
do $$
declare
  v_country_id uuid;
  v_ruleset_id uuid;
  v_scheme_id  uuid;
begin
  select id into v_country_id from countries where iso_code_2 = 'BJ';

  -- CNSS : taux fournis par la demande. Plafond non confirmé à la date de
  -- rédaction — valeur ci-dessous à vérifier auprès de la CNSS Bénin avant
  -- de publier ce tax_rule_set en 'published' pour un client réel.
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'CNSS', 'Caisse Nationale de Sécurité Sociale — Bénin', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_id;

  delete from social_contribution_rates where scheme_id = v_scheme_id;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_id, 0.0360, 0.1540, 500000, null, date '2024-01-01', null);
    -- ⚠️ ceiling_amount = 500 000 FCFA : placeholder non vérifié.

  -- IRPP (catégorie Traitements et Salaires) — barème illustratif à 5 tranches.
  insert into tax_rule_sets (country_id, tax_code, label, version, valid_from, status, published_at)
  values (v_country_id, 'IRPP', 'Barème IRPP Bénin — v1 (illustratif, à valider DGID)',
          1, date '2024-01-01', 'draft', null)
  on conflict (country_id, tax_code, version) do update set label = excluded.label
  returning id into v_ruleset_id;
  -- status = 'draft' intentionnellement : à repasser en 'published' seulement
  -- après validation des tranches par un expert fiscal béninois.

  delete from tax_brackets where tax_rule_set_id = v_ruleset_id;
  insert into tax_brackets (tax_rule_set_id, sequence, min_amount, max_amount, rate, deduction) values
    (v_ruleset_id, 1,      0,  60000, 0.0000,     0),
    (v_ruleset_id, 2,  60001, 150000, 0.1000,  6000),
    (v_ruleset_id, 3, 150001, 250000, 0.1500, 13500),
    (v_ruleset_id, 4, 250001, 500000, 0.1900, 23500),
    (v_ruleset_id, 5, 500001,   null, 0.3000, 78500);

  -- Réduction familiale : hypothèse (5%/enfant, plafonnée à 15% à 3+ enfants).
  -- ⚠️ Le Bénin applique-t-il une réduction de ce type sur les salaires, ou un
  -- mécanisme différent (voire aucun abattement familial) ? À confirmer.
  delete from family_quotient_rules where tax_rule_set_id = v_ruleset_id;
  insert into family_quotient_rules
    (tax_rule_set_id, marital_status, dependents_min, dependents_max, category_code, reduction_rate)
  values
    (v_ruleset_id, null, 0,    0, 'ENFANTS_0',  0.00),
    (v_ruleset_id, null, 1,    1, 'ENFANTS_1',  0.05),
    (v_ruleset_id, null, 2,    2, 'ENFANTS_2',  0.10),
    (v_ruleset_id, null, 3, null, 'ENFANTS_3P', 0.15);
end $$;


-- ----------------------------------------------------------------------------
-- 1.4 RDC (CDF) — CNSS + INPP + ONEM + Taxe d'apprentissage + IPR
-- ----------------------------------------------------------------------------
do $$
declare
  v_country_id     uuid;
  v_ruleset_id     uuid;
  v_scheme_cnss    uuid;
  v_scheme_inpp    uuid;
  v_scheme_onem    uuid;
  v_scheme_taxe    uuid;
  i                int;
begin
  select id into v_country_id from countries where iso_code_2 = 'CD';

  -- CNSS RDC : taux fournis par la demande (Pensions + Risques Pro + Prestations
  -- Familiales confondues). Pas de plafond mensuel renseigné ici : la CNSS RDC
  -- applique un plafond révisable périodiquement, non communiqué dans la
  -- demande — laisser ceiling_amount à NULL (non plafonné) tant que la valeur
  -- officielle n'est pas confirmée, plutôt que d'inventer un chiffre.
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'CNSS', 'Caisse Nationale de Sécurité Sociale — RDC', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_cnss;

  delete from social_contribution_rates where scheme_id = v_scheme_cnss;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_cnss, 0.0500, 0.1300, null, null, date '2024-01-01', null);

  -- INPP : charge 100% patronale, taux standard 2% retenu (la demande indique
  -- une fourchette 2%-3% selon le type d'entreprise ; à surcharger par un
  -- tax_rule_set dédié si un client relève d'un secteur au taux différent).
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'INPP', 'Institut National de Préparation Professionnelle', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_inpp;

  delete from social_contribution_rates where scheme_id = v_scheme_inpp;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_inpp, 0.0000, 0.0200, null, null, date '2024-01-01', null);

  -- ONEM : charge 100% patronale, taux fourni par la demande (0,2%).
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'ONEM', 'Office National de l''Emploi', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_onem;

  delete from social_contribution_rates where scheme_id = v_scheme_onem;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_onem, 0.0000, 0.0020, null, null, date '2024-01-01', null);

  -- Taxe d'apprentissage : citée dans le cahier des charges initial et dans le
  -- moteur (RDCTaxStrategy itère sur INPP/ONEM/TAXE_APPRENTISSAGE) mais AUCUN
  -- taux n'a été communiqué dans cette demande. Placeholder à 0,5% inséré pour
  -- ne pas casser le moteur de calcul — ⚠️ à remplacer par le taux réel avant
  -- toute utilisation en production, sans quoi le net/coût employeur RDC sera
  -- inexact.
  insert into social_contribution_schemes (country_id, code, label, base)
  values (v_country_id, 'TAXE_APPRENTISSAGE', 'Taxe d''Apprentissage', 'salaire_brut')
  on conflict (country_id, code) do update set label = excluded.label
  returning id into v_scheme_taxe;

  delete from social_contribution_rates where scheme_id = v_scheme_taxe;
  insert into social_contribution_rates
    (scheme_id, employee_rate, employer_rate, ceiling_amount, floor_amount, valid_from, valid_to)
  values
    (v_scheme_taxe, 0.0000, 0.0050, null, null, date '2024-01-01', null);

  -- IPR — barème progressif mensuel en CDF, illustratif à 6 tranches.
  -- ⚠️ Point d'attention spécifique RDC (au-delà de la simple validation des
  -- montants) : la dépréciation du CDF signifie que des bornes de tranches
  -- fixes en francs congolais s'éloignent de la réalité économique bien plus
  -- vite qu'un barème XOF. C'est le pays où le versionnage de tax_rule_sets
  -- (note d'architecture, A.3) sera le plus sollicité — prévoir une cadence de
  -- révision annuelle *a minima*, potentiellement infra-annuelle.
  insert into tax_rule_sets (country_id, tax_code, label, version, valid_from, status, published_at)
  values (v_country_id, 'IPR', 'Barème IPR RDC — v1 (illustratif, à valider DGI/DGRAD)',
          1, date '2024-01-01', 'published', now())
  on conflict (country_id, tax_code, version) do update set label = excluded.label
  returning id into v_ruleset_id;

  delete from tax_brackets where tax_rule_set_id = v_ruleset_id;
  insert into tax_brackets (tax_rule_set_id, sequence, min_amount, max_amount, rate, deduction) values
    (v_ruleset_id, 1,       0,  100000, 0.0000,      0),
    (v_ruleset_id, 2,  100001,  300000, 0.1500,  15000),
    (v_ruleset_id, 3,  300001,  500000, 0.2000,  30000),
    (v_ruleset_id, 4,  500001, 1000000, 0.2250,  42500),
    (v_ruleset_id, 5, 1000001, 1500000, 0.2500,  67500),
    (v_ruleset_id, 6, 1500001,     null, 0.3000, 142500);

  -- Réduction pour personnes à charge : 2% par personne, plafonnée à 9
  -- personnes (18%) — valeurs fournies explicitement par la demande. Une
  -- ligne par palier de 0 à 9+ pour un lookup direct côté moteur.
  delete from family_quotient_rules where tax_rule_set_id = v_ruleset_id;
  for i in 0..9 loop
    insert into family_quotient_rules
      (tax_rule_set_id, marital_status, dependents_min, dependents_max, category_code, reduction_rate)
    values (
      v_ruleset_id,
      null,
      i,
      case when i = 9 then null else i end,  -- 9 = "9 et plus" (plafond)
      'PERSONNES_A_CHARGE_' || i,
      least(i, 9) * 0.02
    );
  end loop;
end $$;


-- ============================================================================
-- PARTIE 2 — ROW LEVEL SECURITY (SUPABASE)
-- ============================================================================
-- Note d'architecture : le backend actuel (server/src, Express + Prisma) se
-- connecte à Postgres avec un rôle privilégié (DATABASE_URL) qui, en tant que
-- propriétaire des tables, CONTOURNE RLS par construction — comme tout accès
-- via service_role. Ces politiques ne remplacent donc pas les contrôles déjà
-- écrits dans server/src/lib/permissions.ts pour ce chemin-là. Elles deviennent
-- la ligne de défense principale le jour où le front (ou une appli mobile)
-- appelle Supabase directement via supabase-js avec un JWT `authenticated` —
-- et servent dès maintenant de garde-fou en profondeur si une clé anon/
-- authenticated venait à être exposée côté client.

-- ----------------------------------------------------------------------------
-- 2.1 Fonctions utilitaires
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER + search_path fixé : lit company_users avec les droits du
-- propriétaire de la fonction (qui possède la table et contourne donc RLS),
-- pour éviter la récursion infinie qu'entraînerait une politique sur
-- company_users interrogeant company_users via une requête soumise, elle,
-- à RLS. STABLE permet à Postgres de mettre le résultat en cache pour la
-- durée de la requête plutôt que de la ré-évaluer par ligne.

create or replace function public.get_user_company_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id
  from company_users
  where user_id = auth.uid();
$$;

grant execute on function public.get_user_company_ids() to authenticated;

create or replace function public.user_can_write(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from company_users
    where user_id = auth.uid()
      and company_id = target_company_id
      and role in ('admin', 'hr_manager', 'accountant')
  );
$$;

grant execute on function public.user_can_write(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 2.2 Droits de table (RLS filtre les LIGNES, encore faut-il autoriser
-- l'accès à la TABLE — sans ces GRANT, les politiques ci-dessous ne servent
-- à rien : le rôle `authenticated` n'a par défaut aucun privilège sur des
-- tables créées hors de l'éditeur Supabase Studio).
-- ----------------------------------------------------------------------------
grant select, insert, update, delete
  on companies, employees, payroll_cycles, payroll_entries, payroll_entry_line_items, company_users
  to authenticated;

grant select
  on countries, currencies, tax_rule_sets, tax_brackets,
     family_quotient_rules, social_contribution_schemes, social_contribution_rates
  to authenticated;


-- ----------------------------------------------------------------------------
-- 2.3 Tables sensibles — isolation multi-tenant
-- ----------------------------------------------------------------------------
alter table companies enable row level security;
alter table employees enable row level security;
alter table payroll_cycles enable row level security;
alter table payroll_entries enable row level security;
alter table payroll_entry_line_items enable row level security;
alter table company_users enable row level security;

-- company_users : lecture ouverte aux membres de la même entreprise (annuaire
-- interne), écriture réservée aux rôles admin/hr_manager/accountant.
drop policy if exists "company_users_select_member" on company_users;
create policy "company_users_select_member"
on company_users for select
to authenticated
using (company_id in (select public.get_user_company_ids()));

drop policy if exists "company_users_insert_write_roles" on company_users;
create policy "company_users_insert_write_roles"
on company_users for insert
to authenticated
with check (public.user_can_write(company_id));

drop policy if exists "company_users_update_write_roles" on company_users;
create policy "company_users_update_write_roles"
on company_users for update
to authenticated
using (public.user_can_write(company_id))
with check (public.user_can_write(company_id));

drop policy if exists "company_users_delete_write_roles" on company_users;
create policy "company_users_delete_write_roles"
on company_users for delete
to authenticated
using (public.user_can_write(company_id));

-- companies : lecture pour tout membre ; mise à jour du profil réservée aux
-- rôles de gestion. Pas de politique INSERT/DELETE : la création (onboarding)
-- et la suppression d'entreprise passent par le backend en service_role, qui
-- contourne RLS — une politique INSERT ouverte au grand public n'a pas de
-- sens ici (elle permettrait à n'importe quel compte de créer une entreprise
-- sans jamais devenir membre de la sienne).
drop policy if exists "companies_select_member" on companies;
create policy "companies_select_member"
on companies for select
to authenticated
using (id in (select public.get_user_company_ids()));

drop policy if exists "companies_update_write_roles" on companies;
create policy "companies_update_write_roles"
on companies for update
to authenticated
using (public.user_can_write(id))
with check (public.user_can_write(id));

-- employees
drop policy if exists "employees_select_member" on employees;
create policy "employees_select_member"
on employees for select
to authenticated
using (company_id in (select public.get_user_company_ids()));

drop policy if exists "employees_insert_write_roles" on employees;
create policy "employees_insert_write_roles"
on employees for insert
to authenticated
with check (public.user_can_write(company_id));

drop policy if exists "employees_update_write_roles" on employees;
create policy "employees_update_write_roles"
on employees for update
to authenticated
using (public.user_can_write(company_id))
with check (public.user_can_write(company_id));

drop policy if exists "employees_delete_write_roles" on employees;
create policy "employees_delete_write_roles"
on employees for delete
to authenticated
using (public.user_can_write(company_id));

-- payroll_cycles
drop policy if exists "payroll_cycles_select_member" on payroll_cycles;
create policy "payroll_cycles_select_member"
on payroll_cycles for select
to authenticated
using (company_id in (select public.get_user_company_ids()));

drop policy if exists "payroll_cycles_insert_write_roles" on payroll_cycles;
create policy "payroll_cycles_insert_write_roles"
on payroll_cycles for insert
to authenticated
with check (public.user_can_write(company_id));

drop policy if exists "payroll_cycles_update_write_roles" on payroll_cycles;
create policy "payroll_cycles_update_write_roles"
on payroll_cycles for update
to authenticated
using (public.user_can_write(company_id))
with check (public.user_can_write(company_id));

drop policy if exists "payroll_cycles_delete_write_roles" on payroll_cycles;
create policy "payroll_cycles_delete_write_roles"
on payroll_cycles for delete
to authenticated
using (public.user_can_write(company_id));

-- payroll_entries : pas de company_id direct — jointure via payroll_cycles.
drop policy if exists "payroll_entries_select_member" on payroll_entries;
create policy "payroll_entries_select_member"
on payroll_entries for select
to authenticated
using (
  exists (
    select 1 from payroll_cycles pc
    where pc.id = payroll_entries.payroll_cycle_id
      and pc.company_id in (select public.get_user_company_ids())
  )
);

drop policy if exists "payroll_entries_insert_write_roles" on payroll_entries;
create policy "payroll_entries_insert_write_roles"
on payroll_entries for insert
to authenticated
with check (
  exists (
    select 1 from payroll_cycles pc
    where pc.id = payroll_entries.payroll_cycle_id
      and public.user_can_write(pc.company_id)
  )
);

drop policy if exists "payroll_entries_update_write_roles" on payroll_entries;
create policy "payroll_entries_update_write_roles"
on payroll_entries for update
to authenticated
using (
  exists (
    select 1 from payroll_cycles pc
    where pc.id = payroll_entries.payroll_cycle_id
      and public.user_can_write(pc.company_id)
  )
)
with check (
  exists (
    select 1 from payroll_cycles pc
    where pc.id = payroll_entries.payroll_cycle_id
      and public.user_can_write(pc.company_id)
  )
);

drop policy if exists "payroll_entries_delete_write_roles" on payroll_entries;
create policy "payroll_entries_delete_write_roles"
on payroll_entries for delete
to authenticated
using (
  exists (
    select 1 from payroll_cycles pc
    where pc.id = payroll_entries.payroll_cycle_id
      and public.user_can_write(pc.company_id)
  )
);

-- payroll_entry_line_items : double jointure, payroll_entries -> payroll_cycles.
drop policy if exists "line_items_select_member" on payroll_entry_line_items;
create policy "line_items_select_member"
on payroll_entry_line_items for select
to authenticated
using (
  exists (
    select 1
    from payroll_entries pe
    join payroll_cycles pc on pc.id = pe.payroll_cycle_id
    where pe.id = payroll_entry_line_items.payroll_entry_id
      and pc.company_id in (select public.get_user_company_ids())
  )
);

drop policy if exists "line_items_insert_write_roles" on payroll_entry_line_items;
create policy "line_items_insert_write_roles"
on payroll_entry_line_items for insert
to authenticated
with check (
  exists (
    select 1
    from payroll_entries pe
    join payroll_cycles pc on pc.id = pe.payroll_cycle_id
    where pe.id = payroll_entry_line_items.payroll_entry_id
      and public.user_can_write(pc.company_id)
  )
);

drop policy if exists "line_items_update_write_roles" on payroll_entry_line_items;
create policy "line_items_update_write_roles"
on payroll_entry_line_items for update
to authenticated
using (
  exists (
    select 1
    from payroll_entries pe
    join payroll_cycles pc on pc.id = pe.payroll_cycle_id
    where pe.id = payroll_entry_line_items.payroll_entry_id
      and public.user_can_write(pc.company_id)
  )
)
with check (
  exists (
    select 1
    from payroll_entries pe
    join payroll_cycles pc on pc.id = pe.payroll_cycle_id
    where pe.id = payroll_entry_line_items.payroll_entry_id
      and public.user_can_write(pc.company_id)
  )
);

drop policy if exists "line_items_delete_write_roles" on payroll_entry_line_items;
create policy "line_items_delete_write_roles"
on payroll_entry_line_items for delete
to authenticated
using (
  exists (
    select 1
    from payroll_entries pe
    join payroll_cycles pc on pc.id = pe.payroll_cycle_id
    where pe.id = payroll_entry_line_items.payroll_entry_id
      and public.user_can_write(pc.company_id)
  )
);

-- Piste d'amélioration non implémentée ici (hors périmètre demandé) : un
-- salarié avec role='employee' voit aujourd'hui la liste complète de ses
-- collègues et de tous les bulletins de son entreprise, pas seulement les
-- siens. Pour restreindre un rôle 'employee' à ses propres données, durcir la
-- clause USING de employees/payroll_entries avec un OR reliant
-- company_users.employee_id = auth.uid()-owning-row à employees.id, en plus
-- du user_can_write(). Non fait ici pour rester strictement dans le périmètre
-- "isolation par entreprise" demandé.


-- ----------------------------------------------------------------------------
-- 2.4 Tables de référence — lecture seule pour tout utilisateur authentifié
-- ----------------------------------------------------------------------------
-- family_quotient_rules et social_contribution_rates ne figuraient pas dans
-- la liste de la demande mais sont de même nature que tax_brackets (données
-- de référence versionnées, jamais propres à un tenant) : incluses ici par
-- cohérence. Aucune politique INSERT/UPDATE/DELETE n'est créée pour ces
-- tables — seul un rôle de service (migrations, ce script) peut les modifier ;
-- `authenticated` n'obtient que le SELECT accordé en 2.2.
do $$
declare
  t text;
begin
  foreach t in array array[
    'countries', 'currencies', 'tax_rule_sets', 'tax_brackets',
    'family_quotient_rules', 'social_contribution_schemes', 'social_contribution_rates'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t || '_read_all_authenticated', t);
    execute format(
      'create policy %I on %I for select to authenticated using (true);',
      t || '_read_all_authenticated', t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 2.5 Index de support
-- ----------------------------------------------------------------------------
-- get_user_company_ids() et user_can_write() tapent company_users à chaque
-- appel de politique : sans ces index, chaque SELECT sur une table tenant
-- déclenche un scan séquentiel de company_users.
create index if not exists idx_company_users_user_id on company_users (user_id);
create index if not exists idx_company_users_company_id on company_users (company_id);
create index if not exists idx_payroll_entries_cycle_id on payroll_entries (payroll_cycle_id);
create index if not exists idx_line_items_entry_id on payroll_entry_line_items (payroll_entry_id);

