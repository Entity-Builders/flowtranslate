import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { QuotaStatus } from '../components/QuotaStatus';

describe('quota and account UI', () => {
  it('shows quota/account entry points without asking for a Gemini API key', () => {
    render(<App />);

    expect(screen.queryByText(/Gemini API key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/monthly AI tokens left/i)).not.toBeInTheDocument();
    expect(screen.getByTitle('Account')).toBeInTheDocument();
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

    expect(screen.getByText('Running low')).toBeInTheDocument();
    expect(screen.getByText(/Guest trial/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Technical limit: 250 of 2,000 monthly AI tokens left/i),
    ).toBeInTheDocument();
  });
});
