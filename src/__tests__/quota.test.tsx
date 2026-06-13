import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByText('Te queda poco')).toBeInTheDocument();
    expect(screen.getByText(/Prueba gratis/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Detalle tecnico: quedan 250 de 2,000 creditos mensuales de IA/i),
    ).toBeInTheDocument();
  });

  it('offers Pro and coffee support when quota is exhausted', () => {
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
        quotaUpgradeLabel='Pasar a Pro'
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
      />,
    );

    expect(screen.getByText('Prueba gratis completa')).toBeInTheDocument();
    expect(screen.getByText('Segui respondiendo hoy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pasar a pro/i }));
    fireEvent.click(screen.getByRole('button', { name: /invitar un cafe/i }));

    expect(onQuotaUpgrade).toHaveBeenCalledTimes(1);
    expect(onQuotaSupport).toHaveBeenCalledTimes(1);
  });
});
