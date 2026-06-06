import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('translator UI', () => {
  it('renders one expression input and one result surface as the primary view', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Expression input' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByLabelText('Expression input')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /translate to english/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /improve english/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /explain in spanish/i }),
    ).toBeInTheDocument();
  });

  it('detects English as improvement while keeping the Spanish action available', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Expression input'), {
      target: { value: 'I need help with this task' },
    });

    expect(
      screen.getByRole('button', { name: /improve english/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Spanish$/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBe(2);
  });
});
