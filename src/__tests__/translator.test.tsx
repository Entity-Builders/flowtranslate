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

    expect(
      screen.getByRole('heading', {
        name: /responde mejor en ingles, sin sonar traducido/i,
      }),
    ).toBeInTheDocument();
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

  it('lets visitors start from a work example before signing in', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /responder a un cliente/i }));

    expect(screen.getByLabelText('Mensaje o idea')).toHaveValue(
      'Decile a un cliente que el reporte se demora hasta manana, pero que ya estamos revisando los datos y le vamos a mandar una version clara apenas este lista.',
    );
    expect(
      screen.queryByRole('heading', {
        name: /responde mejor en ingles, sin sonar traducido/i,
      }),
    ).not.toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith(
      'landing_example_selected',
      expect.objectContaining({
        example_id: 'client-delay',
        account_kind: 'none',
      }),
    );
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
