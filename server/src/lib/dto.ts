import { CareerEvent, Employee, EmployeeDocument, User } from '@prisma/client';
import { isPlatformAdminEmail } from './platformAdmin.js';

export function toUserDTO(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId ?? undefined,
    avatar: user.avatar ?? undefined,
    lastLogin: user.lastLogin?.toISOString(),
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    isPlatformAdmin: isPlatformAdminEmail(user.email),
  };
}

const dateOnly = (d: Date) => d.toISOString().split('T')[0];

type EmployeeWithRelations = Employee & {
  documents?: EmployeeDocument[];
  careerHistory?: CareerEvent[];
};

export function toEmployeeDTO(e: EmployeeWithRelations) {
  return {
    id: e.id,
    matricule: e.matricule,
    firstName: e.firstName,
    lastName: e.lastName,
    gender: e.gender,
    dateOfBirth: dateOnly(e.dateOfBirth),
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
    hireDate: dateOnly(e.hireDate),
    trialEndDate: e.trialEndDate ? dateOnly(e.trialEndDate) : undefined,
    contractEndDate: e.contractEndDate ? dateOnly(e.contractEndDate) : undefined,
    position: e.position,
    departmentId: e.departmentId,
    managerId: e.managerId ?? undefined,
    siteLocation: e.siteLocation,
    baseSalary: e.baseSalary,
    paymentMethod: e.paymentMethod,
    mobileMoneyInfo: e.mobileMoneyOperator
      ? {
          operator: e.mobileMoneyOperator,
          phoneNumber: e.mobileMoneyNumber ?? '',
          accountName: e.mobileMoneyAccount ?? '',
        }
      : undefined,
    bankInfo: e.bankRib
      ? {
          bankName: e.bankName ?? '',
          iban: e.bankIban ?? '',
          rib: e.bankRib ?? '',
          accountHolder: e.bankAccountHolder ?? '',
        }
      : undefined,
    cnssNumber: e.cnssNumber ?? undefined,
    iutsCategory: e.iutsCategory,
    avatar: e.avatar ?? undefined,
    // d.url stocke l'URL Blob privée (usage serveur uniquement, via
    // GET .../documents/:id/download) — jamais exposée telle quelle au
    // frontend, qui n'a pas les credentials pour la lire directement.
    documents: (e.documents ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      uploadedAt: d.uploadedAt.toISOString(),
      url: `/employees/${e.id}/documents/${d.id}/download`,
      size: d.size,
    })),
    careerHistory: (e.careerHistory ?? []).map((c) => ({
      id: c.id,
      date: dateOnly(c.date),
      type: c.type,
      description: c.description,
      previousValue: c.previousValue ?? undefined,
      newValue: c.newValue ?? undefined,
      changedBy: c.changedBy,
    })),
    onboardingStatus: {
      contractSigned: e.contractSigned,
      cnssRegistered: e.cnssRegistered,
      equipmentProvided: e.equipmentProvided,
      accessGranted: e.accessGranted,
      trainingCompleted: e.trainingCompleted,
      bankInfoProvided: e.bankInfoProvided,
      photoTaken: e.photoTaken,
    },
  };
}
