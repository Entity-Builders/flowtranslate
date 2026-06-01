import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('learning UI', () => {
  it('keeps Learning in a separate view with empty history state', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /learning/i }));

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(
      screen.getByText(/Translate a few real phrases/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
  });
});
