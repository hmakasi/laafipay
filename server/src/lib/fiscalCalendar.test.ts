import { describe, it, expect } from 'vitest';
import { FISCAL_DEADLINE_RULES } from './fiscalCalendar.js';

describe('FISCAL_DEADLINE_RULES — Sénégal', () => {
  it('inclut une règle de déclaration IR (retenue à la source)', () => {
    const rule = FISCAL_DEADLINE_RULES.find((r) => r.id === 'sn_ir');
    expect(rule).toMatchObject({ countryCode: 'SN', amountSource: 'iuts' });
  });

  it('inclut une règle de cotisations IPRES/CSS', () => {
    const rule = FISCAL_DEADLINE_RULES.find((r) => r.id === 'sn_ipres_css');
    expect(rule).toMatchObject({ countryCode: 'SN', amountSource: 'cnss' });
  });
});
