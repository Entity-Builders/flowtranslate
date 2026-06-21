import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveFlowtranslateBillingState } from '@eb-packages/flowtranslate-core';
import App from '../App';
import { ExpressionWorkspace } from '../components/ExpressionWorkspace';
import { QuotaStatus } from '../components/QuotaStatus';

describe('quota and account UI', () => {
  it('shows quota/account entry points without asking for a Gemini API key', () => {
    render(<App />);

    expect(screen.queryByText(/Gemini API key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/monthly AI tokens left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/creditos mensuales/i)).not.toBeInTheDocument();
    expect(screen.getByTitle('Cuenta')).toBeInTheDocument();
  });

  it('describes usage in human terms before secondary token detail', () => {
    render(
      <QuotaStatus
        accountKind='guest'
        usage={{
          estimatedTokens: 24,
          monthlyQuota: 2000,
          usedThisMonth: 1750,
          remainingThisMonth: 250,
          charged: true,
          resetAt: '2026-07-01T00:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText('Ultimas respuestas gratis')).toBeInTheDocument();
    expect(screen.getByText(/Modo invitado/i)).toBeInTheDocument();
    expect(screen.getByText(/Se renueva el/i)).toBeInTheDocument();
    expect(screen.queryByText(/creditos/i)).not.toBeInTheDocument();
  });

  it('describes a tiered usage pause without calling it a monthly cap', () => {
    render(
      <QuotaStatus
        accountKind='guest'
        usage={{
          estimatedTokens: 24,
          monthlyQuota: 2000,
          usedThisMonth: 500,
          remainingThisMonth: 1500,
          charged: false,
          resetAt: '2026-07-01T00:00:00.000Z',
          recovery: {
            state: 'cooldown',
            stage: 1,
            cooldownUntil: '2099-07-01T00:00:00.000Z',
          },
        }}
      />,
    );

    expect(screen.getAllByText('Pausa de uso amigo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Volvés a tener uso amigo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Gratis usado este mes/i)).not.toBeInTheDocument();
  });

  it('describes active Pro state in quota UI', () => {
    render(
      <QuotaStatus
        accountKind='permanent'
        billingState={resolveFlowtranslateBillingState({
          accountKind: 'permanent',
          entitlement: {
            status: 'active',
            account_kind: 'pro',
            source: 'mercado_pago',
            plan: 'pro',
            last_verified_at: '2026-06-13T12:00:00.000Z',
          },
        })}
        usage={{
          estimatedTokens: 24,
          monthlyQuota: 20000,
          usedThisMonth: 1000,
          remainingThisMonth: 19000,
          charged: true,
          resetAt: '2026-07-01T00:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText(/FlowTranslate Pro/)).toBeInTheDocument();
    expect(screen.getByText(/pro activo para mas respuestas/i)).toBeInTheDocument();
  });

  it('offers Pro and Cafecito support when quota is exhausted', () => {
    const onQuotaUpgrade = vi.fn();
    const onQuotaSupport = vi.fn();

    render(
      <ExpressionWorkspace
        inputText='necesito ayuda'
        resultText=''
        mode='translate_to_english'
        modeDetection={{
          mode: 'translate_to_english',
          confidence: 'high',
          reason: 'manual',
          automatic: false,
        }}
        sourceLanguage='es'
        targetLanguage='en'
        presetId='natural'
        breakdown={null}
        status='quota'
        canTranslate={false}
        translateDisabledReason='Sin cuota'
        copiedInput={false}
        copiedResult={false}
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        statusText='Llegaste al limite mensual'
        quotaUsage={{
          estimatedTokens: 0,
          monthlyQuota: 800,
          usedThisMonth: 800,
          remainingThisMonth: 0,
          charged: false,
          resetAt: '2026-07-01T00:00:00.000Z',
        }}
        quotaUpgradeLabel='Activar Pro'
        onInputChange={vi.fn()}
        onCopyInput={vi.fn()}
        onCopyResult={vi.fn()}
        onListenInput={vi.fn()}
        onListenResult={vi.fn()}
        onDictateInput={vi.fn()}
        onTranslate={vi.fn()}
        onSelectPreset={vi.fn()}
        onRequestBreakdown={vi.fn()}
        onTranslateToSpanish={vi.fn()}
        onQuotaUpgrade={onQuotaUpgrade}
        onQuotaSupport={onQuotaSupport}
        hasSeenResponderPromise={false}
      />,
    );

    expect(screen.getByText('Uso amigo completo')).toBeInTheDocument();
    expect(screen.getByText('Elegí cómo seguir')).toBeInTheDocument();
    expect(screen.getByText('Cafecito + recarga')).toBeInTheDocument();
    expect(screen.getByText('Pro + Learning Path')).toBeInTheDocument();
    expect(screen.getByText(/Tu uso amigo vuelve el 30 de junio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /activar pro/i }));
    fireEvent.click(screen.getByRole('button', { name: /apoyar con cafecito/i }));

    expect(onQuotaUpgrade).toHaveBeenCalledTimes(1);
    expect(onQuotaSupport).toHaveBeenCalledTimes(1);
  });

  it('offers wait, Cafecito, and Pro paths during a tiered usage pause', () => {
    const onQuotaUpgrade = vi.fn();
    const onQuotaSupport = vi.fn();

    render(
      <ExpressionWorkspace
        inputText='necesito ayuda'
        resultText=''
        mode='translate_to_english'
        modeDetection={{
          mode: 'translate_to_english',
          confidence: 'high',
          reason: 'manual',
          automatic: false,
        }}
        sourceLanguage='es'
        targetLanguage='en'
        presetId='natural'
        breakdown={null}
        status='quota'
        canTranslate={false}
        translateDisabledReason='Pausa de uso amigo'
        copiedInput={false}
        copiedResult={false}
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        statusText='Pausa de uso amigo'
        quotaUsage={{
          estimatedTokens: 0,
          monthlyQuota: 800,
          usedThisMonth: 320,
          remainingThisMonth: 480,
          charged: false,
          resetAt: '2026-07-01T00:00:00.000Z',
          recovery: {
            state: 'cooldown',
            stage: 1,
            cooldownUntil: '2099-07-01T00:00:00.000Z',
          },
        }}
        quotaUpgradeLabel='Activar Pro'
        onInputChange={vi.fn()}
        onCopyInput={vi.fn()}
        onCopyResult={vi.fn()}
        onListenInput={vi.fn()}
        onListenResult={vi.fn()}
        onDictateInput={vi.fn()}
        onTranslate={vi.fn()}
        onSelectPreset={vi.fn()}
        onRequestBreakdown={vi.fn()}
        onTranslateToSpanish={vi.fn()}
        onQuotaUpgrade={onQuotaUpgrade}
        onQuotaSupport={onQuotaSupport}
        hasSeenResponderPromise={false}
      />,
    );

    expect(screen.getAllByText('Pausa de uso amigo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Te damos más respuestas/i)).toBeInTheDocument();
    expect(screen.getByText(/seguir sin esta pausa/i)).toBeInTheDocument();
    expect(screen.getByText('Cafecito + recarga')).toBeInTheDocument();
    expect(screen.getByText('Pro + Learning Path')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /activar pro/i }));
    fireEvent.click(screen.getByRole('button', { name: /apoyar con cafecito/i }));

    expect(onQuotaUpgrade).toHaveBeenCalledTimes(1);
    expect(onQuotaSupport).toHaveBeenCalledTimes(1);
  });
});
