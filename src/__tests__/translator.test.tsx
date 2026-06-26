import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEYS } from '../constants';

const analyticsScreen = vi.hoisted(() => vi.fn());
const analyticsTrack = vi.hoisted(() => vi.fn());
const analyticsCaptureError = vi.hoisted(() => vi.fn());
const analyticsGetFeatureFlag = vi.hoisted(() => vi.fn());

vi.mock('../services/analytics', () => ({
  analytics: {
    screen: analyticsScreen,
    track: analyticsTrack,
    captureError: analyticsCaptureError,
    getFeatureFlag: analyticsGetFeatureFlag,
  },
  commercialAnalyticsProperties: (properties: Record<string, unknown>) =>
    properties,
  safeCommercialAnalyticsProperties: (properties: Record<string, unknown>) => properties,
}));

describe('translator UI', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    vi.clearAllMocks();
    analyticsGetFeatureFlag.mockReturnValue(undefined);
  });

  it('renders one expression input and one result surface as the primary view', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /escribí como te salga/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/español, Spanglish o inglés inseguro/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/probalo sin cuenta/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje o idea')).toBeInTheDocument();
    expect(screen.getByLabelText('Tono de respuesta')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copiar respuesta/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /responder en ingles/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mejorar ingles/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /entender en espanol/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /responder a un cliente/i }),
    ).not.toBeInTheDocument();
  });

  it('starts visitors in the direct composer instead of example prompts', () => {
    render(<App />);

    expect(screen.getByLabelText('Mensaje o idea')).toHaveValue('');
    expect(
      screen.getByPlaceholderText(/escribí en español, Spanglish/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/sin login para probar/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reagendar una call/i }),
    ).toBeInTheDocument();
    expect(analyticsTrack).not.toHaveBeenCalledWith(
      'landing_example_selected',
      expect.anything(),
    );
  });

  it('hides the launch promise once the user starts the responder task', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /escribí como te salga/i,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'El reporte se demora hasta manana.' },
    });

    expect(
      screen.queryByRole('heading', {
        name: /escribí como te salga/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/probalo sin cuenta/i)).not.toBeInTheDocument();
  });

  it('clears the responder input from the inline X button', () => {
    render(<App />);

    const input = screen.getByLabelText('Mensaje o idea');
    expect(
      screen.queryByRole('button', { name: /limpiar texto ingresado/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: 'El reporte se demora hasta manana.' },
    });

    const clearButton = screen.getByRole('button', {
      name: /limpiar texto ingresado/i,
    });
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: /limpiar texto ingresado/i }),
    ).not.toBeInTheDocument();
  });

  it('does not show the launch promise again for returning responder users', () => {
    localStorage.setItem(STORAGE_KEYS.responderPromiseSeen, 'true');

    render(<App />);

    expect(screen.getByLabelText('Mensaje o idea')).toHaveValue('');
    expect(
      screen.queryByRole('heading', {
        name: /escribí como te salga/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/probalo sin cuenta/i)).not.toBeInTheDocument();
  });

  it('shows Spanish zero-state suggestions that fill Spanish prompts', () => {
    render(<App />);

    const input = screen.getByLabelText('Mensaje o idea');

    expect(
      screen.getByRole('button', { name: /reagendar una call/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /let me double check/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /avisar demora/i }));

    expect(input).toHaveValue(
      'El reporte se demora hasta manana. Ya estamos revisando los datos y te mando una version clara apenas este lista.',
    );
    expect((input as HTMLTextAreaElement).value).not.toMatch(/decile/i);
    expect(
      screen.queryByRole('button', { name: /avisar demora/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the canonical launch landing demo and continues into the responder from the CTA', () => {
    window.history.pushState(
      {},
      '',
      '/respuestas-en-ingles?utm_campaign=launch-test&utm_content=spanglish',
    );

    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /tu idea en español/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/escribí como te salga — en español, en spanglish/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje del demo')).toHaveValue(
      'No puedo llegar a la call de mañana, algo surgió. Can we move it to Thursday?',
    );
    expect(
      screen.queryByText(/Would Thursday work for you/i),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /convertir a inglés profesional/i }),
    );

    expect(
      screen.getByText(/Would Thursday work for you/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /update de proyecto/i }),
    );
    expect(screen.getByLabelText('Mensaje del demo')).toHaveValue(
      'El reporte tarda, I still need to check numbers, lo mando antes de las 5 pm de todas formas',
    );
    expect(
      screen.queryByText(/Would Thursday work for you/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /probar gratis/i }));

    expect(screen.getByLabelText('Mensaje o idea')).toHaveValue('');
    expect(
      screen.getByText(/continuás desde Mensaje propio/i),
    ).toBeInTheDocument();
  });

  it('presents brief as a tone instead of a more-short command', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'El reporte se demora hasta manana.' },
    });

    const toneSelect = screen.getByLabelText('Tono de respuesta');
    expect(toneSelect).toHaveTextContent('Breve');
    expect(toneSelect).not.toHaveTextContent('Mas corto');
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

    fireEvent.click(screen.getByRole('button', { name: /historial/i }));

    expect(analyticsScreen).toHaveBeenCalledWith(
      'learning',
      expect.objectContaining({
        signed_in: false,
        has_saved_history: false,
        history_count: 0,
      }),
    );
  });

  it('detects English as improvement while keeping a clear Spanish translation action available', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'I need help with this task' },
    });

    expect(
      screen.queryByRole('button', { name: /mejorar ingles/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /pasar a espanol/i }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /^Espanol$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copiar respuesta/i }),
    ).not.toBeInTheDocument();
  });
});
