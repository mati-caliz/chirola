import { IssuerOnboardingStatus } from '@chirola/shared';
import { tokenRelationExplanation } from './arca-onboarding-diagnosis';

describe('tokenRelationExplanation', () => {
  it('pide hacer la delegación si ARCA nunca aceptó al emisor', () => {
    expect(
      tokenRelationExplanation(IssuerOnboardingStatus.PENDING_DELEGATION),
    ).toContain('Administrador de Relaciones');
  });

  it('apunta a la situación fiscal si la delegación ya había funcionado', () => {
    expect(
      tokenRelationExplanation(IssuerOnboardingStatus.DELEGATION_CONFIRMED),
    ).toContain('no está habilitado para facturar');
  });

  it('sigue apuntando a la situación fiscal después de facturar', () => {
    expect(
      tokenRelationExplanation(IssuerOnboardingStatus.ISSUING_CONFIRMED),
    ).toContain('no está habilitado para facturar');
  });

  it('no vuelve a pedir una delegación que ARCA ya bloqueó', () => {
    expect(
      tokenRelationExplanation(IssuerOnboardingStatus.BLOCKED_BY_ARCA),
    ).not.toContain('Administrador de Relaciones');
  });
});
