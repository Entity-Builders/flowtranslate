import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('translator UI', () => {
  it('renders synchronized Spanish and English panels as the primary view', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Spanish' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe o pega texto en español...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type or paste English text...')).toBeInTheDocument();
  });

  it('marks the edited panel as source and exposes copy actions', () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Type or paste English text...'), {
      target: { value: 'hello' },
    });

    expect(screen.getAllByText('Source').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBe(2);
  });
});
