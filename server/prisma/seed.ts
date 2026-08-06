import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';

const DEPARTMENTS = [
  { id: 'dept-direction', name: 'Direction Générale', code: 'DG', managerId: 'emp-009' },
  { id: 'dept-rh', name: 'Ressources Humaines', code: 'RH', managerId: 'emp-001' },
  { id: 'dept-finance', name: 'Finance & Comptabilité', code: 'FIN', managerId: 'emp-002' },
  { id: 'dept-it', name: 'Informatique', code: 'IT', managerId: 'emp-007' },
  { id: 'dept-commercial', name: 'Commercial & Marketing', code: 'COM', managerId: 'emp-018' },
  { id: 'dept-operations', name: 'Opérations', code: 'OPS', managerId: 'emp-015' },
  { id: 'dept-terrain', name: 'Ingénierie Terrain', code: 'TER', managerId: 'emp-015' },
  { id: 'dept-achats', name: 'Achats & Approvisionnement', code: 'ACH', managerId: 'emp-014' },
  { id: 'dept-juridique', name: 'Juridique', code: 'JUR', managerId: 'emp-020' },
  { id: 'dept-securite', name: 'Sécurité', code: 'SEC', managerId: 'emp-015' },
];

interface MockEmployee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  maritalStatus: 'celibataire' | 'marie' | 'divorce' | 'veuf';
  numberOfChildren: number;
  email: string;
  phone: string;
  address: string;
  city: string;
  contractType: 'CDI' | 'CDD' | 'Stage' | 'Journalier' | 'Consultant';
  status: 'actif' | 'periode_essai' | 'en_conge' | 'suspendu' | 'offboarded';
  hireDate: string;
  trialEndDate?: string;
  contractEndDate?: string;
  position: string;
  departmentId: string;
  managerId?: string;
  siteLocation: string;
  baseSalary: number;
  paymentMethod: 'mobile_money' | 'virement' | 'mixte' | 'especes';
  mobileMoneyInfo?: { operator: 'orange' | 'moov' | 'telecel'; phoneNumber: string; accountName: string };
  bankInfo?: { bankName: string; iban: string; rib: string; accountHolder: string };
  cnssNumber?: string;
  iutsCategory: number;
  careerHistory: {
    id: string;
    date: string;
    type: 'embauche' | 'promotion' | 'mutation' | 'augmentation' | 'avertissement' | 'fin_essai';
    description: string;
    previousValue?: string;
    newValue?: string;
    changedBy: string;
  }[];
  onboardingStatus: {
    contractSigned: boolean;
    cnssRegistered: boolean;
    equipmentProvided: boolean;
    accessGranted: boolean;
    trainingCompleted: boolean;
    bankInfoProvided: boolean;
    photoTaken: boolean;
  };
}

const EMPLOYEES: MockEmployee[] = [
  { id: 'emp-001', matricule: 'BF-2021-001', firstName: 'Aminata', lastName: 'OUEDRAOGO', gender: 'F', dateOfBirth: '1985-03-12', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 2, email: 'a.ouedraogo@entreprise.bf', phone: '+22670123456', address: 'Quartier Pissy, Rue 12.43', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2021-03-01', position: 'Responsable RH', departmentId: 'dept-rh', siteLocation: 'Siège social', baseSalary: 450000, paymentMethod: 'virement', bankInfo: { bankName: 'Coris Bank International', iban: 'BF8901234567890', rib: 'BF890-0123-45678', accountHolder: 'OUEDRAOGO Aminata' }, cnssNumber: 'CNSS-2021-001234', iutsCategory: 5, careerHistory: [{ id: 'ce-001', date: '2021-03-01', type: 'embauche', description: 'Recrutement au poste de Responsable RH', newValue: 'Responsable RH', changedBy: 'admin@entreprise.bf' }, { id: 'ce-002', date: '2023-01-01', type: 'augmentation', description: 'Augmentation annuelle', previousValue: '380000 XOF', newValue: '450000 XOF', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-002', matricule: 'BF-2019-002', firstName: 'Moussa', lastName: 'KABORE', gender: 'M', dateOfBirth: '1980-07-25', placeOfBirth: 'Bobo-Dioulasso', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 3, email: 'm.kabore@entreprise.bf', phone: '+22676543210', address: 'Quartier Zogona, Secteur 15', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2019-06-15', position: 'Directeur Financier', departmentId: 'dept-finance', siteLocation: 'Siège social', baseSalary: 780000, paymentMethod: 'virement', bankInfo: { bankName: 'SGBF', iban: 'BF8902345678901', rib: 'BF890-2345-67890', accountHolder: 'KABORE Moussa' }, cnssNumber: 'CNSS-2019-005678', iutsCategory: 7, careerHistory: [{ id: 'ce-010', date: '2019-06-15', type: 'embauche', description: 'Recrutement au poste de Directeur Financier', newValue: 'Directeur Financier', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-003', matricule: 'BF-2022-003', firstName: 'Fatimata', lastName: 'TRAORE', gender: 'F', dateOfBirth: '1995-11-08', placeOfBirth: 'Koudougou', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'f.traore@entreprise.bf', phone: '+22665432109', address: 'Quartier Gounghin, Rue 18.30', city: 'Ouagadougou', contractType: 'CDD', status: 'actif', hireDate: '2022-09-01', contractEndDate: '2024-08-31', position: 'Comptable', departmentId: 'dept-finance', managerId: 'emp-002', siteLocation: 'Siège social', baseSalary: 250000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22665432109', accountName: 'TRAORE Fatimata' }, cnssNumber: 'CNSS-2022-009012', iutsCategory: 3, careerHistory: [{ id: 'ce-020', date: '2022-09-01', type: 'embauche', description: 'Recrutement au poste de Comptable', newValue: 'Comptable', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: false, bankInfoProvided: true, photoTaken: false } },
  { id: 'emp-004', matricule: 'BF-2023-004', firstName: 'Ibrahim', lastName: 'SOME', gender: 'M', dateOfBirth: '1998-04-20', placeOfBirth: 'Gaoua', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'i.some@entreprise.bf', phone: '+22660987654', address: 'Quartier Dapoya, Secteur 3', city: 'Ouagadougou', contractType: 'Stage', status: 'periode_essai', hireDate: '2023-10-01', trialEndDate: '2024-03-31', position: 'Développeur Web Stagiaire', departmentId: 'dept-it', managerId: 'emp-007', siteLocation: 'Siège social', baseSalary: 75000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'moov', phoneNumber: '+22660987654', accountName: 'SOME Ibrahim' }, iutsCategory: 1, careerHistory: [{ id: 'ce-030', date: '2023-10-01', type: 'embauche', description: 'Début du stage', newValue: 'Développeur Web Stagiaire', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: false, equipmentProvided: true, accessGranted: true, trainingCompleted: false, bankInfoProvided: false, photoTaken: false } },
  { id: 'emp-005', matricule: 'BF-2020-005', firstName: 'Rasmané', lastName: 'SAWADOGO', gender: 'M', dateOfBirth: '1978-09-15', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 4, email: 'r.sawadogo@entreprise.bf', phone: '+22671234567', address: 'Quartier Peuloghin, Rue 6.15', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2020-01-15', position: 'Responsable Commercial', departmentId: 'dept-commercial', siteLocation: 'Agence Nord', baseSalary: 380000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22671234567', accountName: 'SAWADOGO Rasmané' }, cnssNumber: 'CNSS-2020-003456', iutsCategory: 4, careerHistory: [{ id: 'ce-040', date: '2020-01-15', type: 'embauche', description: 'Recrutement Responsable Commercial', newValue: 'Responsable Commercial', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: false, photoTaken: true } },
  { id: 'emp-006', matricule: 'BF-2021-006', firstName: 'Aïssata', lastName: 'DIALLO', gender: 'F', dateOfBirth: '1990-02-28', placeOfBirth: 'Bobo-Dioulasso', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 1, email: 'a.diallo@entreprise.bf', phone: '+22674321098', address: 'Quartier Bilbalogo, Secteur 7', city: 'Ouagadougou', contractType: 'CDI', status: 'en_conge', hireDate: '2021-07-01', position: 'Chargée de Recrutement', departmentId: 'dept-rh', managerId: 'emp-001', siteLocation: 'Siège social', baseSalary: 300000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'telecel', phoneNumber: '+22674321098', accountName: 'DIALLO Aïssata' }, cnssNumber: 'CNSS-2021-007890', iutsCategory: 3, careerHistory: [{ id: 'ce-050', date: '2021-07-01', type: 'embauche', description: 'Recrutement Chargée de Recrutement', newValue: 'Chargée de Recrutement', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-007', matricule: 'BF-2018-007', firstName: 'Souleymane', lastName: 'NIKIEMA', gender: 'M', dateOfBirth: '1982-12-05', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 2, email: 's.nikiema@entreprise.bf', phone: '+22672109876', address: 'Quartier Wemtenga, Rue 23.45', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2018-04-01', position: 'Responsable IT', departmentId: 'dept-it', siteLocation: 'Siège social', baseSalary: 520000, paymentMethod: 'virement', bankInfo: { bankName: 'Banque Atlantique', iban: 'BF8903456789012', rib: 'BF890-3456-78901', accountHolder: 'NIKIEMA Souleymane' }, cnssNumber: 'CNSS-2018-001122', iutsCategory: 6, careerHistory: [{ id: 'ce-060', date: '2018-04-01', type: 'embauche', description: 'Recrutement Développeur Senior', newValue: 'Développeur Senior', changedBy: 'admin@entreprise.bf' }, { id: 'ce-061', date: '2020-07-01', type: 'promotion', description: 'Promotion au poste de Responsable IT', previousValue: 'Développeur Senior', newValue: 'Responsable IT', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-008', matricule: 'BF-2023-008', firstName: 'Mariam', lastName: 'COMPAORE', gender: 'F', dateOfBirth: '1996-08-14', placeOfBirth: "Fada N'Gourma", nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'm.compaore@entreprise.bf', phone: '+22663456789', address: 'Quartier Koulouba, Secteur 20', city: 'Ouagadougou', contractType: 'CDI', status: 'periode_essai', hireDate: '2023-08-01', trialEndDate: '2024-01-31', position: 'Assistante Comptable', departmentId: 'dept-finance', managerId: 'emp-002', siteLocation: 'Siège social', baseSalary: 180000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22663456789', accountName: 'COMPAORE Mariam' }, iutsCategory: 2, careerHistory: [{ id: 'ce-070', date: '2023-08-01', type: 'embauche', description: 'Recrutement Assistante Comptable', newValue: 'Assistante Comptable', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: false, accessGranted: true, trainingCompleted: false, bankInfoProvided: false, photoTaken: false } },
  { id: 'emp-009', matricule: 'BF-2017-009', firstName: 'Drissa', lastName: 'BELEM', gender: 'M', dateOfBirth: '1975-06-30', placeOfBirth: 'Dori', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 5, email: 'd.belem@entreprise.bf', phone: '+22678901234', address: 'Quartier Ouaga 2000, Villa 45', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2017-02-01', position: 'Directeur Général', departmentId: 'dept-direction', siteLocation: 'Siège social', baseSalary: 1200000, paymentMethod: 'virement', bankInfo: { bankName: 'BICIAB', iban: 'BF8904567890123', rib: 'BF890-4567-89012', accountHolder: 'BELEM Drissa' }, cnssNumber: 'CNSS-2017-000111', iutsCategory: 8, careerHistory: [{ id: 'ce-080', date: '2017-02-01', type: 'embauche', description: 'Nomination Directeur Général', newValue: 'Directeur Général', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-010', matricule: 'BF-2022-010', firstName: 'Roukiata', lastName: 'YAMEOGO', gender: 'F', dateOfBirth: '1993-01-17', placeOfBirth: 'Tenkodogo', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 1, email: 'r.yameogo@entreprise.bf', phone: '+22669012345', address: 'Quartier Nongmasson, Rue 8.20', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2022-04-01', position: 'Développeuse Frontend', departmentId: 'dept-it', managerId: 'emp-007', siteLocation: 'Siège social', baseSalary: 350000, paymentMethod: 'mixte', mobileMoneyInfo: { operator: 'moov', phoneNumber: '+22669012345', accountName: 'YAMEOGO Roukiata' }, bankInfo: { bankName: 'UBA Burkina', iban: 'BF8905678901234', rib: 'BF890-5678-90123', accountHolder: 'YAMEOGO Roukiata' }, cnssNumber: 'CNSS-2022-010234', iutsCategory: 4, careerHistory: [{ id: 'ce-090', date: '2022-04-01', type: 'embauche', description: 'Recrutement Développeuse Frontend', newValue: 'Développeuse Frontend', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-011', matricule: 'BF-2021-011', firstName: 'Alassane', lastName: 'OUATTARA', gender: 'M', dateOfBirth: '1986-05-22', placeOfBirth: 'Banfora', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 2, email: 'al.ouattara@entreprise.bf', phone: '+22677890123', address: 'Quartier Samandin, Secteur 14', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2021-11-15', position: 'Ingénieur Terrain', departmentId: 'dept-terrain', managerId: 'emp-015', siteLocation: 'Site Koudougou', baseSalary: 320000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22677890123', accountName: 'OUATTARA Alassane' }, cnssNumber: 'CNSS-2021-011345', iutsCategory: 4, careerHistory: [{ id: 'ce-100', date: '2021-11-15', type: 'embauche', description: 'Recrutement Ingénieur Terrain', newValue: 'Ingénieur Terrain', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: false, photoTaken: true } },
  { id: 'emp-012', matricule: 'BF-2020-012', firstName: 'Sandrine', lastName: 'KABORE', gender: 'F', dateOfBirth: '1988-10-03', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 2, email: 's.kabore@entreprise.bf', phone: '+22666789012', address: 'Quartier Hamdalaye, Rue 5.18', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2020-05-01', position: 'Assistante de Direction', departmentId: 'dept-direction', managerId: 'emp-009', siteLocation: 'Siège social', baseSalary: 280000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'telecel', phoneNumber: '+22666789012', accountName: 'KABORE Sandrine' }, cnssNumber: 'CNSS-2020-006789', iutsCategory: 3, careerHistory: [{ id: 'ce-110', date: '2020-05-01', type: 'embauche', description: 'Recrutement Assistante de Direction', newValue: 'Assistante de Direction', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-013', matricule: 'BF-JN-2024-013', firstName: 'Boubacar', lastName: 'ZONGO', gender: 'M', dateOfBirth: '2000-03-11', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'b.zongo@entreprise.bf', phone: '+22661234567', address: 'Quartier Tanghin, Secteur 22', city: 'Ouagadougou', contractType: 'Journalier', status: 'actif', hireDate: '2024-01-08', position: 'Agent de Sécurité', departmentId: 'dept-securite', siteLocation: 'Siège social', baseSalary: 85000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22661234567', accountName: 'ZONGO Boubacar' }, iutsCategory: 1, careerHistory: [{ id: 'ce-120', date: '2024-01-08', type: 'embauche', description: 'Recrutement Agent de Sécurité', newValue: 'Agent de Sécurité', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: false, equipmentProvided: true, accessGranted: false, trainingCompleted: false, bankInfoProvided: false, photoTaken: false } },
  { id: 'emp-014', matricule: 'BF-2019-014', firstName: 'Haoua', lastName: 'TIENDREBEOGO', gender: 'F', dateOfBirth: '1983-07-19', placeOfBirth: 'Ziniaré', nationality: 'Burkinabè', maritalStatus: 'veuf', numberOfChildren: 3, email: 'h.tiendrebeogo@entreprise.bf', phone: '+22675678901', address: 'Quartier Cissin, Rue 14.22', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2019-09-02', position: 'Responsable Achats', departmentId: 'dept-achats', siteLocation: 'Siège social', baseSalary: 390000, paymentMethod: 'virement', bankInfo: { bankName: 'Ecobank Burkina', iban: 'BF8906789012345', rib: 'BF890-6789-01234', accountHolder: 'TIENDREBEOGO Haoua' }, cnssNumber: 'CNSS-2019-008901', iutsCategory: 5, careerHistory: [{ id: 'ce-130', date: '2019-09-02', type: 'embauche', description: 'Recrutement Responsable Achats', newValue: 'Responsable Achats', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-015', matricule: 'BF-2016-015', firstName: 'Wendyam', lastName: 'ILBOUDO', gender: 'M', dateOfBirth: '1977-11-25', placeOfBirth: 'Ouahigouya', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 3, email: 'w.ilboudo@entreprise.bf', phone: '+22673456789', address: 'Quartier Ouaga 2000, Rue des Pamplemousses', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2016-03-01', position: 'Directeur des Opérations', departmentId: 'dept-operations', managerId: 'emp-009', siteLocation: 'Siège social', baseSalary: 920000, paymentMethod: 'virement', bankInfo: { bankName: 'Coris Bank International', iban: 'BF8907890123456', rib: 'BF890-7890-12345', accountHolder: 'ILBOUDO Wendyam' }, cnssNumber: 'CNSS-2016-000999', iutsCategory: 8, careerHistory: [{ id: 'ce-140', date: '2016-03-01', type: 'embauche', description: 'Recrutement Directeur des Opérations', newValue: 'Directeur des Opérations', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-016', matricule: 'BF-2022-016', firstName: 'Salimata', lastName: 'BARRY', gender: 'F', dateOfBirth: '1991-04-08', placeOfBirth: 'Bobo-Dioulasso', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 2, email: 'sa.barry@entreprise.bf', phone: '+22668901234', address: 'Quartier Wemtenga, Secteur 12', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2022-01-10', position: 'Chargée de Communication', departmentId: 'dept-commercial', managerId: 'emp-005', siteLocation: 'Siège social', baseSalary: 260000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22668901234', accountName: 'BARRY Salimata' }, cnssNumber: 'CNSS-2022-012456', iutsCategory: 3, careerHistory: [{ id: 'ce-150', date: '2022-01-10', type: 'embauche', description: 'Recrutement Chargée de Communication', newValue: 'Chargée de Communication', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-017', matricule: 'BF-2023-017', firstName: 'Appolinaire', lastName: 'DA', gender: 'M', dateOfBirth: '1994-12-30', placeOfBirth: 'Diébougou', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'ap.da@entreprise.bf', phone: '+22664567890', address: 'Quartier Pissy, Secteur 28', city: 'Ouagadougou', contractType: 'CDD', status: 'actif', hireDate: '2023-03-01', contractEndDate: '2025-02-28', position: 'Technicien Maintenance', departmentId: 'dept-operations', managerId: 'emp-015', siteLocation: 'Atelier Central', baseSalary: 195000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'moov', phoneNumber: '+22664567890', accountName: 'DA Appolinaire' }, cnssNumber: 'CNSS-2023-013567', iutsCategory: 2, careerHistory: [{ id: 'ce-160', date: '2023-03-01', type: 'embauche', description: 'Recrutement Technicien Maintenance', newValue: 'Technicien Maintenance', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: false, bankInfoProvided: false, photoTaken: true } },
  { id: 'emp-018', matricule: 'BF-2018-018', firstName: 'Nathalie', lastName: 'OUEDRAOGO', gender: 'F', dateOfBirth: '1981-09-07', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 3, email: 'n.ouedraogo@entreprise.bf', phone: '+22679012345', address: 'Quartier Gounghin Nord, Rue 2.5', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2018-11-01', position: 'Directrice Commerciale', departmentId: 'dept-commercial', managerId: 'emp-009', siteLocation: 'Siège social', baseSalary: 650000, paymentMethod: 'virement', bankInfo: { bankName: 'SGBF', iban: 'BF8908901234567', rib: 'BF890-8901-23456', accountHolder: 'OUEDRAOGO Nathalie' }, cnssNumber: 'CNSS-2018-005566', iutsCategory: 7, careerHistory: [{ id: 'ce-170', date: '2018-11-01', type: 'embauche', description: 'Recrutement Directrice Commerciale', newValue: 'Directrice Commerciale', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-019', matricule: 'BF-2024-019', firstName: 'Yacouba', lastName: 'SAWADOGO', gender: 'M', dateOfBirth: '2001-06-15', placeOfBirth: 'Kaya', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'y.sawadogo@entreprise.bf', phone: '+22662345678', address: 'Quartier Yaar, Secteur 16', city: 'Ouagadougou', contractType: 'Stage', status: 'periode_essai', hireDate: '2024-01-15', trialEndDate: '2024-07-14', position: 'Stagiaire Marketing', departmentId: 'dept-commercial', managerId: 'emp-018', siteLocation: 'Siège social', baseSalary: 60000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22662345678', accountName: 'SAWADOGO Yacouba' }, iutsCategory: 1, careerHistory: [{ id: 'ce-180', date: '2024-01-15', type: 'embauche', description: 'Début stage Marketing', newValue: 'Stagiaire Marketing', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: false, equipmentProvided: false, accessGranted: true, trainingCompleted: false, bankInfoProvided: false, photoTaken: false } },
  { id: 'emp-020', matricule: 'BF-2020-020', firstName: 'Estelle', lastName: 'KINDA', gender: 'F', dateOfBirth: '1987-03-25', placeOfBirth: 'Pô', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 1, email: 'e.kinda@entreprise.bf', phone: '+22676543987', address: 'Quartier Dassasgho, Rue 10.3', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2020-08-01', position: "Juriste d'Entreprise", departmentId: 'dept-juridique', managerId: 'emp-009', siteLocation: 'Siège social', baseSalary: 480000, paymentMethod: 'virement', bankInfo: { bankName: 'Banque Sahélo-Saharienne', iban: 'BF8909012345678', rib: 'BF890-9012-34567', accountHolder: 'KINDA Estelle' }, cnssNumber: 'CNSS-2020-009900', iutsCategory: 5, careerHistory: [{ id: 'ce-190', date: '2020-08-01', type: 'embauche', description: "Recrutement Juriste d'Entreprise", newValue: "Juriste d'Entreprise", changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-021', matricule: 'BF-2021-021', firstName: 'Noufou', lastName: 'ZOUNGRANA', gender: 'M', dateOfBirth: '1984-08-12', placeOfBirth: 'Manga', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 4, email: 'n.zoungrana@entreprise.bf', phone: '+22678234567', address: 'Quartier Tampouy, Secteur 25', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2021-05-10', position: 'Responsable Logistique', departmentId: 'dept-operations', managerId: 'emp-015', siteLocation: 'Entrepôt Central', baseSalary: 340000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'telecel', phoneNumber: '+22678234567', accountName: 'ZOUNGRANA Noufou' }, cnssNumber: 'CNSS-2021-014678', iutsCategory: 4, careerHistory: [{ id: 'ce-200', date: '2021-05-10', type: 'embauche', description: 'Recrutement Responsable Logistique', newValue: 'Responsable Logistique', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: false, photoTaken: true } },
  { id: 'emp-022', matricule: 'BF-2023-022', firstName: 'Clarisse', lastName: 'TOURE', gender: 'F', dateOfBirth: '1997-10-02', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'c.toure@entreprise.bf', phone: '+22663890234', address: "Quartier Patte d'Oie, Rue 19.8", city: 'Ouagadougou', contractType: 'CDD', status: 'actif', hireDate: '2023-06-01', contractEndDate: '2025-05-31', position: 'Analyste Financière', departmentId: 'dept-finance', managerId: 'emp-002', siteLocation: 'Siège social', baseSalary: 220000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'orange', phoneNumber: '+22663890234', accountName: 'TOURE Clarisse' }, cnssNumber: 'CNSS-2023-015789', iutsCategory: 3, careerHistory: [{ id: 'ce-210', date: '2023-06-01', type: 'embauche', description: 'Recrutement Analyste Financière', newValue: 'Analyste Financière', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-023', matricule: 'BF-2019-023', firstName: 'Aristide', lastName: 'PALME', gender: 'M', dateOfBirth: '1979-01-14', placeOfBirth: 'Dédougou', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 3, email: 'ar.palme@entreprise.bf', phone: '+22674901234', address: 'Quartier Karpala, Secteur 30', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2019-12-01', position: 'Chef Comptable', departmentId: 'dept-finance', managerId: 'emp-002', siteLocation: 'Siège social', baseSalary: 560000, paymentMethod: 'virement', bankInfo: { bankName: 'BICIAB', iban: 'BF8910123456789', rib: 'BF890-0123-45679', accountHolder: 'PALME Aristide' }, cnssNumber: 'CNSS-2019-011122', iutsCategory: 6, careerHistory: [{ id: 'ce-220', date: '2019-12-01', type: 'embauche', description: 'Recrutement Chef Comptable', newValue: 'Chef Comptable', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-024', matricule: 'BF-2022-024', firstName: 'Bibata', lastName: 'OUEDRAOGO', gender: 'F', dateOfBirth: '1992-06-18', placeOfBirth: 'Ouagadougou', nationality: 'Burkinabè', maritalStatus: 'celibataire', numberOfChildren: 0, email: 'bi.ouedraogo@entreprise.bf', phone: '+22667234589', address: 'Quartier Ouidi, Rue 7.2', city: 'Ouagadougou', contractType: 'CDI', status: 'actif', hireDate: '2022-07-18', position: 'Développeur Backend', departmentId: 'dept-it', managerId: 'emp-007', siteLocation: 'Siège social', baseSalary: 370000, paymentMethod: 'mobile_money', mobileMoneyInfo: { operator: 'moov', phoneNumber: '+22667234589', accountName: 'OUEDRAOGO Bibata' }, cnssNumber: 'CNSS-2022-016890', iutsCategory: 4, careerHistory: [{ id: 'ce-230', date: '2022-07-18', type: 'embauche', description: 'Recrutement Développeur Backend', newValue: 'Développeur Backend', changedBy: 'a.ouedraogo@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
  { id: 'emp-025', matricule: 'BF-2017-025', firstName: 'Lassina', lastName: 'COULIBALY', gender: 'M', dateOfBirth: '1974-04-05', placeOfBirth: 'Bobo-Dioulasso', nationality: 'Burkinabè', maritalStatus: 'marie', numberOfChildren: 5, email: 'l.coulibaly@entreprise.bf', phone: '+22672678901', address: 'Quartier Secteur 30, Rue Principale', city: 'Bobo-Dioulasso', contractType: 'CDI', status: 'actif', hireDate: '2017-09-01', position: 'Responsable Agence Bobo', departmentId: 'dept-commercial', managerId: 'emp-018', siteLocation: 'Agence Bobo-Dioulasso', baseSalary: 580000, paymentMethod: 'virement', bankInfo: { bankName: 'Bank Of Africa', iban: 'BF8911234567890', rib: 'BF890-1234-56789', accountHolder: 'COULIBALY Lassina' }, cnssNumber: 'CNSS-2017-003344', iutsCategory: 6, careerHistory: [{ id: 'ce-240', date: '2017-09-01', type: 'embauche', description: 'Recrutement Responsable Agence Bobo', newValue: 'Responsable Agence Bobo', changedBy: 'admin@entreprise.bf' }], onboardingStatus: { contractSigned: true, cnssRegistered: true, equipmentProvided: true, accessGranted: true, trainingCompleted: true, bankInfoProvided: true, photoTaken: true } },
];

const USERS = [
  { id: 'user-admin', firstName: 'Système', lastName: 'Admin', email: 'admin@entreprise.bf', role: 'admin' as const, employeeId: undefined },
  { id: 'user-hr', firstName: 'Aminata', lastName: 'OUEDRAOGO', email: 'a.ouedraogo@entreprise.bf', role: 'hr_manager' as const, employeeId: 'emp-001' },
  { id: 'user-manager', firstName: 'Souleymane', lastName: 'NIKIEMA', email: 's.nikiema@entreprise.bf', role: 'manager' as const, employeeId: 'emp-007' },
  { id: 'user-accountant', firstName: 'Moussa', lastName: 'KABORE', email: 'm.kabore@entreprise.bf', role: 'accountant' as const, employeeId: 'emp-002' },
  { id: 'user-employee', firstName: 'Roukiata', lastName: 'YAMEOGO', email: 'r.yameogo@entreprise.bf', role: 'employee' as const, employeeId: 'emp-010' },
  { id: 'user-manager2', firstName: 'Nathalie', lastName: 'OUEDRAOGO', email: 'n.ouedraogo@entreprise.bf', role: 'manager' as const, employeeId: 'emp-018' },
];

async function main() {
  console.log('Seeding: entreprise de démo...');
  const company = await prisma.company.create({
    data: {
      id: 'company-demo',
      name: 'LaafiPay Demo',
      legalName: 'LaafiPay Demo SARL',
      ifu: '00000000A',
      rccm: 'BF-OUA-2024-B-00000',
      address: 'Siège social, Ouagadougou',
      city: 'Ouagadougou',
      country: 'Burkina Faso',
      phone: '+22625000000',
      email: 'contact@entreprise.bf',
      cnssNumber: 'CNSS-EMP-000000',
    },
  });

  console.log('Seeding: departments (sans manager)...');
  for (const d of DEPARTMENTS) {
    await prisma.department.create({ data: { id: d.id, companyId: company.id, name: d.name, code: d.code } });
  }

  console.log('Seeding: employees (sans manager)...');
  for (const e of EMPLOYEES) {
    const data: Prisma.EmployeeCreateInput = {
      id: e.id,
      company: { connect: { id: company.id } },
      matricule: e.matricule,
      firstName: e.firstName,
      lastName: e.lastName,
      gender: e.gender,
      dateOfBirth: new Date(e.dateOfBirth),
      placeOfBirth: e.placeOfBirth,
      nationality: e.nationality,
      maritalStatus: e.maritalStatus,
      numberOfChildren: e.numberOfChildren,
      email: e.email,
      phone: e.phone,
      address: e.address,
      city: e.city,
      contractType: e.contractType,
      status: e.status,
      hireDate: new Date(e.hireDate),
      trialEndDate: e.trialEndDate ? new Date(e.trialEndDate) : undefined,
      contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : undefined,
      position: e.position,
      department: { connect: { id: e.departmentId } },
      siteLocation: e.siteLocation,
      baseSalary: e.baseSalary,
      paymentMethod: e.paymentMethod,
      mobileMoneyOperator: e.mobileMoneyInfo?.operator,
      mobileMoneyNumber: e.mobileMoneyInfo?.phoneNumber,
      mobileMoneyAccount: e.mobileMoneyInfo?.accountName,
      bankName: e.bankInfo?.bankName,
      bankIban: e.bankInfo?.iban,
      bankRib: e.bankInfo?.rib,
      bankAccountHolder: e.bankInfo?.accountHolder,
      cnssNumber: e.cnssNumber,
      iutsCategory: e.iutsCategory,
      ...e.onboardingStatus,
      careerHistory: {
        create: e.careerHistory.map((c) => ({
          id: c.id,
          date: new Date(c.date),
          type: c.type,
          description: c.description,
          previousValue: c.previousValue,
          newValue: c.newValue,
          changedBy: c.changedBy,
        })),
      },
    };
    await prisma.employee.create({ data });
  }

  console.log('Seeding: liens manager (employés + départements)...');
  for (const e of EMPLOYEES) {
    if (e.managerId) {
      await prisma.employee.update({ where: { id: e.id }, data: { managerId: e.managerId } });
    }
  }
  for (const d of DEPARTMENTS) {
    await prisma.department.update({ where: { id: d.id }, data: { managerId: d.managerId } });
  }

  console.log('Seeding: utilisateurs...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        id: u.id,
        companyId: company.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash,
        role: u.role,
        employeeId: u.employeeId,
        isActive: true,
      },
    });
  }

  console.log(`Terminé. ${EMPLOYEES.length} employés, ${DEPARTMENTS.length} départements, ${USERS.length} utilisateurs.`);
  console.log(`Mot de passe de test pour tous les comptes démo : ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
