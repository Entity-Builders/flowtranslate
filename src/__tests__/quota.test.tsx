import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
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
});
