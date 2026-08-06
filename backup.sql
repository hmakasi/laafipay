--
-- PostgreSQL database dump
--

\restrict AiCRxgMV6Ao8rrMI3eFgOfMbATWb5MbOcg7MoD8FALKbGwTC67y25riYko7voaL

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: CareerEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CareerEventType" AS ENUM (
    'embauche',
    'promotion',
    'mutation',
    'augmentation',
    'avertissement',
    'fin_essai'
);


--
-- Name: ContractType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContractType" AS ENUM (
    'CDI',
    'CDD',
    'Stage',
    'Journalier',
    'Consultant'
);


--
-- Name: DocumentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentType" AS ENUM (
    'contrat',
    'avenant',
    'piece_identite',
    'diplome',
    'attestation',
    'autre'
);


--
-- Name: EmployeeInviteStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmployeeInviteStatus" AS ENUM (
    'not_invited',
    'invited',
    'completed'
);


--
-- Name: EmployeeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmployeeStatus" AS ENUM (
    'actif',
    'periode_essai',
    'en_conge',
    'suspendu',
    'offboarded'
);


--
-- Name: Gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Gender" AS ENUM (
    'M',
    'F'
);


--
-- Name: MaritalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MaritalStatus" AS ENUM (
    'celibataire',
    'marie',
    'divorce',
    'veuf'
);


--
-- Name: MobileMoneyOperator; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MobileMoneyOperator" AS ENUM (
    'orange',
    'moov',
    'telecel'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'mobile_money',
    'virement',
    'mixte',
    'especes'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'admin',
    'hr_manager',
    'manager',
    'accountant',
    'employee'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CareerEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CareerEvent" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type public."CareerEventType" NOT NULL,
    description text NOT NULL,
    "previousValue" text,
    "newValue" text,
    "changedBy" text NOT NULL
);


--
-- Name: Company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Company" (
    id text NOT NULL,
    name text NOT NULL,
    "legalName" text,
    ifu text,
    rccm text,
    address text,
    city text,
    country text,
    phone text,
    email text,
    "cnssNumber" text,
    logo text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    "managerId" text,
    "parentId" text,
    "companyId" text NOT NULL
);


--
-- Name: Employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Employee" (
    id text NOT NULL,
    matricule text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    gender public."Gender" NOT NULL,
    "dateOfBirth" timestamp(3) without time zone NOT NULL,
    "placeOfBirth" text NOT NULL,
    nationality text NOT NULL,
    "maritalStatus" public."MaritalStatus" NOT NULL,
    "numberOfChildren" integer DEFAULT 0 NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    "contractType" public."ContractType" NOT NULL,
    status public."EmployeeStatus" DEFAULT 'periode_essai'::public."EmployeeStatus" NOT NULL,
    "hireDate" timestamp(3) without time zone NOT NULL,
    "trialEndDate" timestamp(3) without time zone,
    "contractEndDate" timestamp(3) without time zone,
    "position" text NOT NULL,
    "departmentId" text NOT NULL,
    "managerId" text,
    "siteLocation" text NOT NULL,
    "baseSalary" double precision NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    "mobileMoneyOperator" public."MobileMoneyOperator",
    "mobileMoneyNumber" text,
    "mobileMoneyAccount" text,
    "bankName" text,
    "bankIban" text,
    "bankRib" text,
    "bankAccountHolder" text,
    "cnssNumber" text,
    "iutsCategory" integer DEFAULT 1 NOT NULL,
    avatar text,
    "contractSigned" boolean DEFAULT false NOT NULL,
    "cnssRegistered" boolean DEFAULT false NOT NULL,
    "equipmentProvided" boolean DEFAULT false NOT NULL,
    "accessGranted" boolean DEFAULT false NOT NULL,
    "trainingCompleted" boolean DEFAULT false NOT NULL,
    "bankInfoProvided" boolean DEFAULT false NOT NULL,
    "photoTaken" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL,
    "inviteStatus" public."EmployeeInviteStatus" DEFAULT 'not_invited'::public."EmployeeInviteStatus" NOT NULL,
    "inviteToken" text
);


--
-- Name: EmployeeDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmployeeDocument" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    type public."DocumentType" NOT NULL,
    name text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    url text NOT NULL,
    size integer NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."UserRole" NOT NULL,
    "employeeId" text,
    avatar text,
    "lastLogin" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: CareerEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CareerEvent" (id, "employeeId", date, type, description, "previousValue", "newValue", "changedBy") FROM stdin;
ce-001	emp-001	2021-03-01 00:00:00	embauche	Recrutement au poste de Responsable RH	\N	Responsable RH	admin@entreprise.bf
ce-002	emp-001	2023-01-01 00:00:00	augmentation	Augmentation annuelle	380000 XOF	450000 XOF	admin@entreprise.bf
ce-010	emp-002	2019-06-15 00:00:00	embauche	Recrutement au poste de Directeur Financier	\N	Directeur Financier	admin@entreprise.bf
ce-020	emp-003	2022-09-01 00:00:00	embauche	Recrutement au poste de Comptable	\N	Comptable	a.ouedraogo@entreprise.bf
ce-030	emp-004	2023-10-01 00:00:00	embauche	Début du stage	\N	Développeur Web Stagiaire	a.ouedraogo@entreprise.bf
ce-040	emp-005	2020-01-15 00:00:00	embauche	Recrutement Responsable Commercial	\N	Responsable Commercial	admin@entreprise.bf
ce-050	emp-006	2021-07-01 00:00:00	embauche	Recrutement Chargée de Recrutement	\N	Chargée de Recrutement	admin@entreprise.bf
ce-060	emp-007	2018-04-01 00:00:00	embauche	Recrutement Développeur Senior	\N	Développeur Senior	admin@entreprise.bf
ce-061	emp-007	2020-07-01 00:00:00	promotion	Promotion au poste de Responsable IT	Développeur Senior	Responsable IT	admin@entreprise.bf
ce-070	emp-008	2023-08-01 00:00:00	embauche	Recrutement Assistante Comptable	\N	Assistante Comptable	a.ouedraogo@entreprise.bf
ce-080	emp-009	2017-02-01 00:00:00	embauche	Nomination Directeur Général	\N	Directeur Général	admin@entreprise.bf
ce-090	emp-010	2022-04-01 00:00:00	embauche	Recrutement Développeuse Frontend	\N	Développeuse Frontend	a.ouedraogo@entreprise.bf
ce-100	emp-011	2021-11-15 00:00:00	embauche	Recrutement Ingénieur Terrain	\N	Ingénieur Terrain	a.ouedraogo@entreprise.bf
ce-110	emp-012	2020-05-01 00:00:00	embauche	Recrutement Assistante de Direction	\N	Assistante de Direction	admin@entreprise.bf
ce-120	emp-013	2024-01-08 00:00:00	embauche	Recrutement Agent de Sécurité	\N	Agent de Sécurité	a.ouedraogo@entreprise.bf
ce-130	emp-014	2019-09-02 00:00:00	embauche	Recrutement Responsable Achats	\N	Responsable Achats	admin@entreprise.bf
ce-140	emp-015	2016-03-01 00:00:00	embauche	Recrutement Directeur des Opérations	\N	Directeur des Opérations	admin@entreprise.bf
ce-150	emp-016	2022-01-10 00:00:00	embauche	Recrutement Chargée de Communication	\N	Chargée de Communication	a.ouedraogo@entreprise.bf
ce-160	emp-017	2023-03-01 00:00:00	embauche	Recrutement Technicien Maintenance	\N	Technicien Maintenance	a.ouedraogo@entreprise.bf
ce-170	emp-018	2018-11-01 00:00:00	embauche	Recrutement Directrice Commerciale	\N	Directrice Commerciale	admin@entreprise.bf
ce-180	emp-019	2024-01-15 00:00:00	embauche	Début stage Marketing	\N	Stagiaire Marketing	a.ouedraogo@entreprise.bf
ce-190	emp-020	2020-08-01 00:00:00	embauche	Recrutement Juriste d'Entreprise	\N	Juriste d'Entreprise	admin@entreprise.bf
ce-200	emp-021	2021-05-10 00:00:00	embauche	Recrutement Responsable Logistique	\N	Responsable Logistique	a.ouedraogo@entreprise.bf
ce-210	emp-022	2023-06-01 00:00:00	embauche	Recrutement Analyste Financière	\N	Analyste Financière	a.ouedraogo@entreprise.bf
ce-220	emp-023	2019-12-01 00:00:00	embauche	Recrutement Chef Comptable	\N	Chef Comptable	admin@entreprise.bf
ce-230	emp-024	2022-07-18 00:00:00	embauche	Recrutement Développeur Backend	\N	Développeur Backend	a.ouedraogo@entreprise.bf
ce-240	emp-025	2017-09-01 00:00:00	embauche	Recrutement Responsable Agence Bobo	\N	Responsable Agence Bobo	admin@entreprise.bf
cmscgnse30001hagw1ebvm451	cmscgnse20000hagw91ddp40o	2026-08-02 23:58:13.367	embauche	Recrutement au poste de Assistant Test	\N	Assistant Test	admin@entreprise.bf
\.


--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Company" (id, name, "legalName", ifu, rccm, address, city, country, phone, email, "cnssNumber", logo, "createdAt", "updatedAt") FROM stdin;
company-demo	LaafiPay Demo	LaafiPay Demo SARL	00000000A	BF-OUA-2024-B-00000	Siège social, Ouagadougou	Ouagadougou	Burkina Faso	+22625000000	contact@entreprise.bf	CNSS-EMP-000000	\N	2026-08-02 13:22:10.943	2026-08-02 13:22:10.943
cmsbu7w3y0000ha7cn6woh67f	Acme SARL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-02 13:30:00.142	2026-08-02 13:30:00.142
cmsbueosi0005ha7c5cxypbcy	kiimia	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-02 13:35:17.251	2026-08-02 13:35:17.251
cmseg9z5q0002hagwx665dkgb	KIIMIA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-04 09:23:01.311	2026-08-04 09:23:01.311
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Department" (id, name, code, "managerId", "parentId", "companyId") FROM stdin;
dept-direction	Direction Générale	DG	emp-009	\N	company-demo
dept-rh	Ressources Humaines	RH	emp-001	\N	company-demo
dept-finance	Finance & Comptabilité	FIN	emp-002	\N	company-demo
dept-it	Informatique	IT	emp-007	\N	company-demo
dept-commercial	Commercial & Marketing	COM	emp-018	\N	company-demo
dept-operations	Opérations	OPS	emp-015	\N	company-demo
dept-terrain	Ingénierie Terrain	TER	emp-015	\N	company-demo
dept-achats	Achats & Approvisionnement	ACH	emp-014	\N	company-demo
dept-juridique	Juridique	JUR	emp-020	\N	company-demo
dept-securite	Sécurité	SEC	emp-015	\N	company-demo
\.


--
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Employee" (id, matricule, "firstName", "lastName", gender, "dateOfBirth", "placeOfBirth", nationality, "maritalStatus", "numberOfChildren", email, phone, address, city, "contractType", status, "hireDate", "trialEndDate", "contractEndDate", "position", "departmentId", "managerId", "siteLocation", "baseSalary", "paymentMethod", "mobileMoneyOperator", "mobileMoneyNumber", "mobileMoneyAccount", "bankName", "bankIban", "bankRib", "bankAccountHolder", "cnssNumber", "iutsCategory", avatar, "contractSigned", "cnssRegistered", "equipmentProvided", "accessGranted", "trainingCompleted", "bankInfoProvided", "photoTaken", "createdAt", "updatedAt", "companyId", "inviteStatus", "inviteToken") FROM stdin;
emp-001	BF-2021-001	Aminata	OUEDRAOGO	F	1985-03-12 00:00:00	Ouagadougou	Burkinabè	marie	2	a.ouedraogo@entreprise.bf	+22670123456	Quartier Pissy, Rue 12.43	Ouagadougou	CDI	actif	2021-03-01 00:00:00	\N	\N	Responsable RH	dept-rh	\N	Siège social	450000	virement	\N	\N	\N	Coris Bank International	BF8901234567890	BF890-0123-45678	OUEDRAOGO Aminata	CNSS-2021-001234	5	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.003	2026-08-02 13:22:11.003	company-demo	not_invited	\N
emp-002	BF-2019-002	Moussa	KABORE	M	1980-07-25 00:00:00	Bobo-Dioulasso	Burkinabè	marie	3	m.kabore@entreprise.bf	+22676543210	Quartier Zogona, Secteur 15	Ouagadougou	CDI	actif	2019-06-15 00:00:00	\N	\N	Directeur Financier	dept-finance	\N	Siège social	780000	virement	\N	\N	\N	SGBF	BF8902345678901	BF890-2345-67890	KABORE Moussa	CNSS-2019-005678	7	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.023	2026-08-02 13:22:11.023	company-demo	not_invited	\N
emp-005	BF-2020-005	Rasmané	SAWADOGO	M	1978-09-15 00:00:00	Ouagadougou	Burkinabè	marie	4	r.sawadogo@entreprise.bf	+22671234567	Quartier Peuloghin, Rue 6.15	Ouagadougou	CDI	actif	2020-01-15 00:00:00	\N	\N	Responsable Commercial	dept-commercial	\N	Agence Nord	380000	mobile_money	orange	+22671234567	SAWADOGO Rasmané	\N	\N	\N	\N	CNSS-2020-003456	4	\N	t	t	t	t	t	f	t	2026-08-02 13:22:11.055	2026-08-02 13:22:11.055	company-demo	not_invited	\N
emp-007	BF-2018-007	Souleymane	NIKIEMA	M	1982-12-05 00:00:00	Ouagadougou	Burkinabè	marie	2	s.nikiema@entreprise.bf	+22672109876	Quartier Wemtenga, Rue 23.45	Ouagadougou	CDI	actif	2018-04-01 00:00:00	\N	\N	Responsable IT	dept-it	\N	Siège social	520000	virement	\N	\N	\N	Banque Atlantique	BF8903456789012	BF890-3456-78901	NIKIEMA Souleymane	CNSS-2018-001122	6	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.077	2026-08-02 13:22:11.077	company-demo	not_invited	\N
emp-009	BF-2017-009	Drissa	BELEM	M	1975-06-30 00:00:00	Dori	Burkinabè	marie	5	d.belem@entreprise.bf	+22678901234	Quartier Ouaga 2000, Villa 45	Ouagadougou	CDI	actif	2017-02-01 00:00:00	\N	\N	Directeur Général	dept-direction	\N	Siège social	1200000	virement	\N	\N	\N	BICIAB	BF8904567890123	BF890-4567-89012	BELEM Drissa	CNSS-2017-000111	8	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.098	2026-08-02 13:22:11.098	company-demo	not_invited	\N
emp-013	BF-JN-2024-013	Boubacar	ZONGO	M	2000-03-11 00:00:00	Ouagadougou	Burkinabè	celibataire	0	b.zongo@entreprise.bf	+22661234567	Quartier Tanghin, Secteur 22	Ouagadougou	Journalier	actif	2024-01-08 00:00:00	\N	\N	Agent de Sécurité	dept-securite	\N	Siège social	85000	mobile_money	orange	+22661234567	ZONGO Boubacar	\N	\N	\N	\N	\N	1	\N	t	f	t	f	f	f	f	2026-08-02 13:22:11.134	2026-08-02 13:22:11.134	company-demo	not_invited	\N
emp-014	BF-2019-014	Haoua	TIENDREBEOGO	F	1983-07-19 00:00:00	Ziniaré	Burkinabè	veuf	3	h.tiendrebeogo@entreprise.bf	+22675678901	Quartier Cissin, Rue 14.22	Ouagadougou	CDI	actif	2019-09-02 00:00:00	\N	\N	Responsable Achats	dept-achats	\N	Siège social	390000	virement	\N	\N	\N	Ecobank Burkina	BF8906789012345	BF890-6789-01234	TIENDREBEOGO Haoua	CNSS-2019-008901	5	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.144	2026-08-02 13:22:11.144	company-demo	not_invited	\N
emp-004	BF-2023-004	Ibrahim	SOME	M	1998-04-20 00:00:00	Gaoua	Burkinabè	celibataire	0	i.some@entreprise.bf	+22660987654	Quartier Dapoya, Secteur 3	Ouagadougou	Stage	periode_essai	2023-10-01 00:00:00	2024-03-31 00:00:00	\N	Développeur Web Stagiaire	dept-it	emp-007	Siège social	75000	mobile_money	moov	+22660987654	SOME Ibrahim	\N	\N	\N	\N	\N	1	\N	t	f	t	t	f	f	f	2026-08-02 13:22:11.043	2026-08-02 13:22:11.247	company-demo	not_invited	\N
emp-006	BF-2021-006	Aïssata	DIALLO	F	1990-02-28 00:00:00	Bobo-Dioulasso	Burkinabè	marie	1	a.diallo@entreprise.bf	+22674321098	Quartier Bilbalogo, Secteur 7	Ouagadougou	CDI	en_conge	2021-07-01 00:00:00	\N	\N	Chargée de Recrutement	dept-rh	emp-001	Siège social	300000	mobile_money	telecel	+22674321098	DIALLO Aïssata	\N	\N	\N	\N	CNSS-2021-007890	3	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.067	2026-08-02 13:22:11.25	company-demo	not_invited	\N
emp-008	BF-2023-008	Mariam	COMPAORE	F	1996-08-14 00:00:00	Fada N'Gourma	Burkinabè	celibataire	0	m.compaore@entreprise.bf	+22663456789	Quartier Koulouba, Secteur 20	Ouagadougou	CDI	periode_essai	2023-08-01 00:00:00	2024-01-31 00:00:00	\N	Assistante Comptable	dept-finance	emp-002	Siège social	180000	mobile_money	orange	+22663456789	COMPAORE Mariam	\N	\N	\N	\N	\N	2	\N	t	t	f	t	f	f	f	2026-08-02 13:22:11.087	2026-08-02 13:22:11.254	company-demo	not_invited	\N
emp-010	BF-2022-010	Roukiata	YAMEOGO	F	1993-01-17 00:00:00	Tenkodogo	Burkinabè	celibataire	1	r.yameogo@entreprise.bf	+22669012345	Quartier Nongmasson, Rue 8.20	Ouagadougou	CDI	actif	2022-04-01 00:00:00	\N	\N	Développeuse Frontend	dept-it	emp-007	Siège social	350000	mixte	moov	+22669012345	YAMEOGO Roukiata	UBA Burkina	BF8905678901234	BF890-5678-90123	YAMEOGO Roukiata	CNSS-2022-010234	4	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.105	2026-08-02 13:22:11.266	company-demo	not_invited	\N
emp-011	BF-2021-011	Alassane	OUATTARA	M	1986-05-22 00:00:00	Banfora	Burkinabè	marie	2	al.ouattara@entreprise.bf	+22677890123	Quartier Samandin, Secteur 14	Ouagadougou	CDI	actif	2021-11-15 00:00:00	\N	\N	Ingénieur Terrain	dept-terrain	emp-015	Site Koudougou	320000	mobile_money	orange	+22677890123	OUATTARA Alassane	\N	\N	\N	\N	CNSS-2021-011345	4	\N	t	t	t	t	t	f	t	2026-08-02 13:22:11.116	2026-08-02 13:22:11.273	company-demo	not_invited	\N
emp-012	BF-2020-012	Sandrine	KABORE	F	1988-10-03 00:00:00	Ouagadougou	Burkinabè	marie	2	s.kabore@entreprise.bf	+22666789012	Quartier Hamdalaye, Rue 5.18	Ouagadougou	CDI	actif	2020-05-01 00:00:00	\N	\N	Assistante de Direction	dept-direction	emp-009	Siège social	280000	mobile_money	telecel	+22666789012	KABORE Sandrine	\N	\N	\N	\N	CNSS-2020-006789	3	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.124	2026-08-02 13:22:11.279	company-demo	not_invited	\N
emp-015	BF-2016-015	Wendyam	ILBOUDO	M	1977-11-25 00:00:00	Ouahigouya	Burkinabè	marie	3	w.ilboudo@entreprise.bf	+22673456789	Quartier Ouaga 2000, Rue des Pamplemousses	Ouagadougou	CDI	actif	2016-03-01 00:00:00	\N	\N	Directeur des Opérations	dept-operations	emp-009	Siège social	920000	virement	\N	\N	\N	Coris Bank International	BF8907890123456	BF890-7890-12345	ILBOUDO Wendyam	CNSS-2016-000999	8	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.153	2026-08-02 13:22:11.283	company-demo	not_invited	\N
emp-016	BF-2022-016	Salimata	BARRY	F	1991-04-08 00:00:00	Bobo-Dioulasso	Burkinabè	marie	2	sa.barry@entreprise.bf	+22668901234	Quartier Wemtenga, Secteur 12	Ouagadougou	CDI	actif	2022-01-10 00:00:00	\N	\N	Chargée de Communication	dept-commercial	emp-005	Siège social	260000	mobile_money	orange	+22668901234	BARRY Salimata	\N	\N	\N	\N	CNSS-2022-012456	3	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.161	2026-08-02 13:22:11.288	company-demo	not_invited	\N
emp-017	BF-2023-017	Appolinaire	DA	M	1994-12-30 00:00:00	Diébougou	Burkinabè	celibataire	0	ap.da@entreprise.bf	+22664567890	Quartier Pissy, Secteur 28	Ouagadougou	CDD	actif	2023-03-01 00:00:00	\N	2025-02-28 00:00:00	Technicien Maintenance	dept-operations	emp-015	Atelier Central	195000	mobile_money	moov	+22664567890	DA Appolinaire	\N	\N	\N	\N	CNSS-2023-013567	2	\N	t	t	t	t	f	f	t	2026-08-02 13:22:11.169	2026-08-02 13:22:11.292	company-demo	not_invited	\N
emp-018	BF-2018-018	Nathalie	OUEDRAOGO	F	1981-09-07 00:00:00	Ouagadougou	Burkinabè	marie	3	n.ouedraogo@entreprise.bf	+22679012345	Quartier Gounghin Nord, Rue 2.5	Ouagadougou	CDI	actif	2018-11-01 00:00:00	\N	\N	Directrice Commerciale	dept-commercial	emp-009	Siège social	650000	virement	\N	\N	\N	SGBF	BF8908901234567	BF890-8901-23456	OUEDRAOGO Nathalie	CNSS-2018-005566	7	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.177	2026-08-02 13:22:11.296	company-demo	not_invited	\N
emp-019	BF-2024-019	Yacouba	SAWADOGO	M	2001-06-15 00:00:00	Kaya	Burkinabè	celibataire	0	y.sawadogo@entreprise.bf	+22662345678	Quartier Yaar, Secteur 16	Ouagadougou	Stage	periode_essai	2024-01-15 00:00:00	2024-07-14 00:00:00	\N	Stagiaire Marketing	dept-commercial	emp-018	Siège social	60000	mobile_money	orange	+22662345678	SAWADOGO Yacouba	\N	\N	\N	\N	\N	1	\N	t	f	f	t	f	f	f	2026-08-02 13:22:11.184	2026-08-02 13:22:11.3	company-demo	not_invited	\N
emp-020	BF-2020-020	Estelle	KINDA	F	1987-03-25 00:00:00	Pô	Burkinabè	celibataire	1	e.kinda@entreprise.bf	+22676543987	Quartier Dassasgho, Rue 10.3	Ouagadougou	CDI	actif	2020-08-01 00:00:00	\N	\N	Juriste d'Entreprise	dept-juridique	emp-009	Siège social	480000	virement	\N	\N	\N	Banque Sahélo-Saharienne	BF8909012345678	BF890-9012-34567	KINDA Estelle	CNSS-2020-009900	5	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.192	2026-08-02 13:22:11.304	company-demo	not_invited	\N
emp-003	BF-2022-003	Fatimata	TRAORE	F	1995-11-08 00:00:00	Koudougou	Burkinabè	celibataire	0	f.traore@entreprise.bf	+22665432109	Quartier Gounghin, Rue 18.30	Ouagadougou	CDD	actif	2022-09-01 00:00:00	\N	2024-08-31 00:00:00	Comptable	dept-finance	emp-002	Siège social	250000	mobile_money	orange	+22665432109	TRAORE Fatimata	\N	\N	\N	\N	CNSS-2022-009012	3	\N	t	t	t	t	f	t	f	2026-08-02 13:22:11.033	2026-08-02 13:22:11.241	company-demo	not_invited	\N
emp-021	BF-2021-021	Noufou	ZOUNGRANA	M	1984-08-12 00:00:00	Manga	Burkinabè	marie	4	n.zoungrana@entreprise.bf	+22678234567	Quartier Tampouy, Secteur 25	Ouagadougou	CDI	actif	2021-05-10 00:00:00	\N	\N	Responsable Logistique	dept-operations	emp-015	Entrepôt Central	340000	mobile_money	telecel	+22678234567	ZOUNGRANA Noufou	\N	\N	\N	\N	CNSS-2021-014678	4	\N	t	t	t	t	t	f	t	2026-08-02 13:22:11.2	2026-08-02 13:22:11.308	company-demo	not_invited	\N
emp-022	BF-2023-022	Clarisse	TOURE	F	1997-10-02 00:00:00	Ouagadougou	Burkinabè	celibataire	0	c.toure@entreprise.bf	+22663890234	Quartier Patte d'Oie, Rue 19.8	Ouagadougou	CDD	actif	2023-06-01 00:00:00	\N	2025-05-31 00:00:00	Analyste Financière	dept-finance	emp-002	Siège social	220000	mobile_money	orange	+22663890234	TOURE Clarisse	\N	\N	\N	\N	CNSS-2023-015789	3	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.208	2026-08-02 13:22:11.314	company-demo	not_invited	\N
emp-023	BF-2019-023	Aristide	PALME	M	1979-01-14 00:00:00	Dédougou	Burkinabè	marie	3	ar.palme@entreprise.bf	+22674901234	Quartier Karpala, Secteur 30	Ouagadougou	CDI	actif	2019-12-01 00:00:00	\N	\N	Chef Comptable	dept-finance	emp-002	Siège social	560000	virement	\N	\N	\N	BICIAB	BF8910123456789	BF890-0123-45679	PALME Aristide	CNSS-2019-011122	6	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.218	2026-08-02 13:22:11.32	company-demo	not_invited	\N
emp-024	BF-2022-024	Bibata	OUEDRAOGO	F	1992-06-18 00:00:00	Ouagadougou	Burkinabè	celibataire	0	bi.ouedraogo@entreprise.bf	+22667234589	Quartier Ouidi, Rue 7.2	Ouagadougou	CDI	actif	2022-07-18 00:00:00	\N	\N	Développeur Backend	dept-it	emp-007	Siège social	370000	mobile_money	moov	+22667234589	OUEDRAOGO Bibata	\N	\N	\N	\N	CNSS-2022-016890	4	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.225	2026-08-02 13:22:11.324	company-demo	not_invited	\N
emp-025	BF-2017-025	Lassina	COULIBALY	M	1974-04-05 00:00:00	Bobo-Dioulasso	Burkinabè	marie	5	l.coulibaly@entreprise.bf	+22672678901	Quartier Secteur 30, Rue Principale	Bobo-Dioulasso	CDI	actif	2017-09-01 00:00:00	\N	\N	Responsable Agence Bobo	dept-commercial	emp-018	Agence Bobo-Dioulasso	580000	virement	\N	\N	\N	Bank Of Africa	BF8911234567890	BF890-1234-56789	COULIBALY Lassina	CNSS-2017-003344	6	\N	t	t	t	t	t	t	t	2026-08-02 13:22:11.233	2026-08-02 13:22:11.329	company-demo	not_invited	\N
cmscgnse20000hagw91ddp40o	BF-2024-099	Testeur	INVITE	F	1995-12-05 00:00:00	Ouagadougou	Burkinabè	celibataire	0	testeur.invite@entreprise.bf	+22670001122	Secteur 15, Ouagadougou	Ouagadougou	CDI	periode_essai	2026-08-02 00:00:00	\N	\N	Assistant Test	dept-rh	\N	Siège social	150000	especes	orange	+22670001122	Testeur INVITE	\N	\N	\N	\N	CNSS-2024-TEST-001	1	\N	f	f	f	f	f	f	f	2026-08-02 23:58:13.37	2026-08-02 23:59:36.642	company-demo	completed	\N
\.


--
-- Data for Name: EmployeeDocument; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EmployeeDocument" (id, "employeeId", type, name, "uploadedAt", url, size) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "firstName", "lastName", email, "passwordHash", role, "employeeId", avatar, "lastLogin", "isActive", "createdAt", "updatedAt", "companyId") FROM stdin;
user-manager	Souleymane	NIKIEMA	s.nikiema@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	manager	emp-007	\N	\N	t	2026-08-02 13:22:11.468	2026-08-02 13:22:11.468	company-demo
user-manager2	Nathalie	OUEDRAOGO	n.ouedraogo@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	manager	emp-018	\N	\N	t	2026-08-02 13:22:11.48	2026-08-02 13:22:11.48	company-demo
cmsbu7w440002ha7cvhh82x5b	Alice	KONE	alice.kone@acme.bf	$2a$10$Y2GtOXssiwLLaNx5pkUy..haALzT5UTTN.pETp22iS3RYwC6k3tpK	admin	\N	\N	\N	t	2026-08-02 13:30:00.148	2026-08-02 13:30:00.148	cmsbu7w3y0000ha7cn6woh67f
cmsbu9qk70004ha7cns4xnohd	Bakary	SANOU	bakary.sanou@acme.bf	$2a$10$PK3Dq8fSGjLCPS.tuvur2.84Fme2gfYiSYljrN.yifxmreLhrKv0G	hr_manager	\N	\N	2026-08-02 13:32:37.944	t	2026-08-02 13:31:26.263	2026-08-02 13:32:37.945	cmsbu7w3y0000ha7cn6woh67f
cmsbueoso0007ha7cknl8p2jy	uriel	makasi	hermaskoualet@gmail.com	$2a$10$jJo2DB6Tv0k.XAfJmbnJtuqIC5U8li205ITe1HkXd74jvCC70VjO.	admin	\N	\N	\N	t	2026-08-02 13:35:17.256	2026-08-02 13:35:17.256	cmsbueosi0005ha7c5cxypbcy
user-hr	Aminata	OUEDRAOGO	a.ouedraogo@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	hr_manager	emp-001	\N	2026-08-02 16:03:03.767	t	2026-08-02 13:22:11.464	2026-08-02 16:03:03.769	company-demo
user-employee	Roukiata	YAMEOGO	r.yameogo@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	employee	emp-010	\N	2026-08-02 21:57:37.569	t	2026-08-02 13:22:11.475	2026-08-02 21:57:37.571	company-demo
user-accountant	Moussa	KABORE	m.kabore@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	accountant	emp-002	\N	2026-08-03 00:11:54.306	t	2026-08-02 13:22:11.471	2026-08-03 00:11:54.308	company-demo
cmseg9z760004hagwbeqa8w7d	Joseph	IYEME	joeiyeme@gmail.com	$2a$10$qLMMEccQLATqNudXLgAQKup05npyNmz7tSPkKWq6Pkxj9acPwsnmi	admin	\N	\N	\N	t	2026-08-04 09:23:01.36	2026-08-04 09:23:01.36	cmseg9z5q0002hagwx665dkgb
cmsegkqkf0006hagwn7cqspng	Marlie	MAKASI	marlie@test.com	$2a$10$YhYb.LuIM7gGUSkDkazpa.kpMidfUk2vFL/5dWHY0TJDU0E/8mYNi	hr_manager	\N	\N	\N	t	2026-08-04 09:31:23.391	2026-08-04 09:31:23.391	cmseg9z5q0002hagwx665dkgb
user-admin	Système	Admin	admin@entreprise.bf	$2a$10$nSwtvkaUAJHVtGE9Ox2JwOJIL5bbeYP/zvmzmP/B0vaHUf56r1a.W	admin	\N	\N	2026-08-06 17:23:43.197	t	2026-08-02 13:22:11.455	2026-08-06 17:23:43.202	company-demo
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
771af473-8f20-41a5-8992-03c6c4365af7	e9b6d51e44a1bcfaa4e4a4dfd989f9c75c8c28c5b5ee3efa2303bf31472f1f8c	2026-08-02 12:58:15.483073+00	20260802125815_init	\N	\N	2026-08-02 12:58:15.372328+00	1
716db787-e69b-4283-9906-411c3db5ef40	08dd1b2d05a3f69f228a4304627dfed173f073451c3a5074f3ee2ae75b5c78c9	\N	20260802130000_multi_tenant	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260802130000_multi_tenant\n\nDatabase error code: 42601\n\nDatabase error:\nERROR: syntax error at or near "warn"\n\nPosition:\n[1m  0[0m\n[1m  1[1;31m warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).[0m\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42601), message: "syntax error at or near \\"warn\\"", detail: None, hint: None, position: Some(Original(1)), where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("scan.l"), line: Some(1244), routine: Some("scanner_yyerror") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260802130000_multi_tenant"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20260802130000_multi_tenant"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:260	2026-08-02 13:20:59.35446+00	2026-08-02 13:20:34.102549+00	0
65beaa82-c1f6-42ae-a481-77c28127388d	ec87d432aac453f42f94c7fd9a4425ba83a4a899bd9789cdf3bd9807bcac3a46	2026-08-02 13:21:05.588311+00	20260802130000_multi_tenant	\N	\N	2026-08-02 13:21:05.530109+00	1
f93f3f32-afd1-49f9-90a6-823980966a5c	8a8590c8db590b5ed7fff906845a865782e20d72a000afc35a455c55474235b9	2026-08-02 23:40:07.908927+00	20260803010000_employee_onboarding	\N	\N	2026-08-02 23:40:07.853689+00	1
c9b365fd-0b2d-4c80-8d29-68b5795dd59b	f57a808d8dcd226a1ec4f5b36a9ae80040c35cd6550704fbfd05d6111f04bb03	2026-08-02 23:42:02.951432+00	20260803011500_rename_invite_fields	\N	\N	2026-08-02 23:42:02.919676+00	1
\.


--
-- Name: CareerEvent CareerEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CareerEvent"
    ADD CONSTRAINT "CareerEvent_pkey" PRIMARY KEY (id);


--
-- Name: Company Company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeDocument EmployeeDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY (id);


--
-- Name: Employee Employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Department_companyId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Department_companyId_code_key" ON public."Department" USING btree ("companyId", code);


--
-- Name: Employee_companyId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_companyId_email_key" ON public."Employee" USING btree ("companyId", email);


--
-- Name: Employee_companyId_matricule_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_companyId_matricule_key" ON public."Employee" USING btree ("companyId", matricule);


--
-- Name: Employee_inviteToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Employee_inviteToken_key" ON public."Employee" USING btree ("inviteToken");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_employeeId_key" ON public."User" USING btree ("employeeId");


--
-- Name: CareerEvent CareerEvent_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CareerEvent"
    ADD CONSTRAINT "CareerEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Department Department_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Department Department_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Department Department_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeDocument EmployeeDocument_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Employee Employee_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Employee Employee_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Employee Employee_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict AiCRxgMV6Ao8rrMI3eFgOfMbATWb5MbOcg7MoD8FALKbGwTC67y25riYko7voaL

