import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const analyticsScreen = vi.hoisted(() => vi.fn());
const analyticsTrack = vi.hoisted(() => vi.fn());

vi.mock('../services/analytics', () => ({
  analytics: {
    screen: analyticsScreen,
    track: analyticsTrack,
  },
}));

describe('translator UI', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders one expression input and one result surface as the primary view', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Mensaje o idea' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Respuesta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje o idea')).toBeInTheDocument();
    expect(screen.getByLabelText('Tono de respuesta')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /responder en ingles/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /mejorar ingles/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /entender en espanol/i }),
    ).toBeInTheDocument();
  });

  it('tracks app view changes for Translate and Learning', () => {
    render(<App />);

    expect(analyticsScreen).toHaveBeenCalledWith(
      'translate',
      expect.objectContaining({
        signed_in: false,
        has_saved_history: false,
        history_count: 0,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /aprender/i }));

    expect(analyticsScreen).toHaveBeenCalledWith(
      'learning',
      expect.objectContaining({
        signed_in: false,
        has_saved_history: false,
        history_count: 0,
      }),
    );
  });

  it('detects English as improvement while keeping the Spanish action available', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'I need help with this task' },
    });

    expect(
      screen.getByRole('button', { name: /mejorar ingles/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Espanol$/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /copiar texto/i }).length).toBe(2);
  });
});
