import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsScreen = vi.hoisted(() => vi.fn());
const analyticsTrack = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const onAuthStateChange = vi.hoisted(() => vi.fn());
const signInAnonymously = vi.hoisted(() => vi.fn());
const signInWithOAuth = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const linkIdentity = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const generateTranslation = vi.hoisted(() => vi.fn());

vi.mock('../services/analytics', () => ({
  analytics: {
    screen: analyticsScreen,
    track: analyticsTrack,
  },
}));

vi.mock('../services/translation-history', () => ({
  listTranslationHistory: vi.fn().mockResolvedValue([]),
  deleteTranslationRecord: vi.fn().mockResolvedValue(undefined),
  clearTranslationHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/flowtranslate-api', () => ({
  FlowtranslateApiError: class FlowtranslateApiError extends Error {
    status: number;
    usage: unknown;

    constructor(message: string, status = 500, usage?: unknown) {
      super(message);
      this.status = status;
      this.usage = usage;
    }
  },
  generateTranslation,
  generateLearningInsight: vi.fn(),
  generateStudyArticle: vi.fn(),
  askBreakdownQuestion: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  getFlowtranslateFunctionUrl: () => 'http://localhost/functions/v1/flowtranslate-generate',
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
      signInAnonymously,
      signInWithOAuth,
      signInWithOtp,
      linkIdentity,
      verifyOtp,
      signOut,
    },
  },
}));

import App from '../App';

const guestSession = {
  access_token: 'guest-token',
  refresh_token: 'guest-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'guest-user',
    email: '',
    is_anonymous: true,
  },
};

describe('account access UI', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    signInAnonymously.mockResolvedValue({ data: { session: null }, error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    signInWithOtp.mockResolvedValue({ error: null });
    linkIdentity.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    generateTranslation.mockResolvedValue({
      kind: 'translate',
      text: 'Hi, can you send me the update?',
      mode: 'translate_to_english',
      breakdown: null,
      translationRecord: {
        id: 'record-1',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        mode: 'translate_to_english',
        breakdown: null,
        createdAt: '2026-06-05T12:00:00.000Z',
      },
      usage: {
        estimatedTokens: 4,
        monthlyQuota: 100,
        usedThisMonth: 4,
        remainingThisMonth: 96,
        charged: true,
        resetAt: '2026-07-01T00:00:00.000Z',
      },
    });
  });

  it('starts an anonymous guest session on first load without opening the account modal', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith('auth_guest_submitted', {
      method: 'anonymous',
      source: 'automatic',
    });
  });

  it('uses a returned anonymous session as the initial guest trial', async () => {
    signInAnonymously.mockResolvedValueOnce({
      data: { session: guestSession },
      error: null,
    });

    render(<App />);

    expect(await screen.findByText('Prueba gratis')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cuenta' })).not.toBeInTheDocument();
  });

  it('offers Google, guest trial, and progressive email code sign-in', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Cuenta'));

    expect(
      await screen.findByRole('button', { name: /continuar con google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /iniciar prueba gratis/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/codigo/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /usar codigo por email/i }));

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/codigo/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'juan@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar codigo/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'juan@example.com',
      options: {
        emailRedirectTo: window.location.origin,
      },
    }));
    expect(await screen.findByLabelText(/codigo/i)).toBeInTheDocument();
  });

  it('starts guest auth and Google OAuth from the account modal', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Cuenta'));
    fireEvent.click(
      await screen.findByRole('button', { name: /continuar con google/i }),
    );

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    }));

    fireEvent.click(screen.getByRole('button', { name: /iniciar prueba gratis/i }));

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(2));
    expect(analyticsTrack).toHaveBeenCalledWith('auth_guest_submitted', {
      method: 'anonymous',
      source: 'manual',
    });
  });

  it('links Google identity when the current session is a guest', async () => {
    getSession.mockResolvedValue({ data: { session: guestSession } });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Cuenta'));
    fireEvent.click(
      await screen.findByRole('button', { name: /conectar con google/i }),
    );

    await waitFor(() => expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    }));
    expect(screen.getAllByText(/prueba gratis/i).length).toBeGreaterThan(1);
  });

  it('prompts guests to connect an account only after repeated copied replies', async () => {
    signInAnonymously.mockResolvedValueOnce({
      data: { session: guestSession },
      error: null,
    });

    render(<App />);

    await screen.findByText('Prueba gratis');
    expect(screen.queryByText(/Guarda tu tono/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'me pasas el update?' },
    });
    fireEvent.click(screen.getByTitle('Generar respuesta'));

    expect(
      await screen.findByText('Hi, can you send me the update?'),
    ).toBeInTheDocument();

    const resultCopyButton = () => screen.getAllByTitle('Copiar texto')[1];
    fireEvent.click(resultCopyButton());
    fireEvent.click(resultCopyButton());

    expect(await screen.findByText(/Guarda tu tono/i)).toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith(
      'account_connect_prompt_shown',
      expect.objectContaining({
        surface: 'translate_soft_banner',
        reason: 'copied_replies',
      }),
    );
  });
});
