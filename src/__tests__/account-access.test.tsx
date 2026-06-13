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
const profileMaybeSingle = vi.hoisted(() => vi.fn());
const profileUpdate = vi.hoisted(() => vi.fn());

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
    from: (table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain = {
        select: () => chain,
        update: profileUpdate,
        eq: () => chain,
        maybeSingle: profileMaybeSingle,
      };

      profileUpdate.mockReturnValue(chain);

      return chain;
    },
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

const permanentSession = {
  access_token: 'permanent-token',
  refresh_token: 'permanent-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'permanent-user',
    email: 'juan@example.com',
    is_anonymous: false,
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
    profileUpdate.mockReturnValue(undefined);
    profileMaybeSingle.mockResolvedValue({ data: null, error: null });
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

  it('starts normal Google OAuth from a guest session instead of linking identity', async () => {
    getSession.mockResolvedValue({ data: { session: guestSession } });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Cuenta'));
    fireEvent.click(
      await screen.findByRole('button', { name: /conectar con google/i }),
    );

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(linkIdentity).not.toHaveBeenCalled();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    expect(analyticsTrack).toHaveBeenCalledWith(
      'auth_oauth_submitted',
      expect.objectContaining({
        method: 'google_oauth_from_guest',
      }),
    );
  });

  it('shows a permanent profile editor and saves context explicitly', async () => {
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    profileMaybeSingle
      .mockResolvedValueOnce({
        data: {
          user_id: 'permanent-user',
          email: 'juan@example.com',
          global_context: 'Soy PM en una agencia.',
          current_streak: 0,
          last_study_date: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user_id: 'permanent-user',
          email: 'juan@example.com',
          global_context: 'Soy PM en una agencia de software.',
          current_streak: 0,
          last_study_date: null,
        },
        error: null,
      });

    render(<App />);

    expect(await screen.findByText('Perfil')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Perfil'));

    expect(
      await screen.findByText(/perfil profesional/i),
    ).toBeInTheDocument();

    const profileField = screen.getByLabelText(/contexto permanente/i);
    expect(profileField).toHaveValue('Soy PM en una agencia.');

    fireEvent.change(profileField, {
      target: { value: 'Soy PM en una agencia de software.' },
    });

    expect(profileUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /guardar perfil/i }));

    await waitFor(() =>
      expect(profileUpdate).toHaveBeenCalledWith({
        global_context: 'Soy PM en una agencia de software.',
      }),
    );
    expect(await screen.findByText(/perfil guardado/i)).toBeInTheDocument();
  });

  it('cleans up an existing Google identity link error on return', async () => {
    window.history.pushState(
      {},
      '',
      '/?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user#error=server_error&error_code=identity_already_exists',
    );
    getSession.mockResolvedValue({ data: { session: guestSession } });

    render(<App />);

    expect(
      await screen.findByText(/ese google ya esta conectado a otra cuenta/i),
    ).toBeInTheDocument();
    expect(signOut).toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(analyticsTrack).toHaveBeenCalledWith(
      'auth_oauth_returned_error',
      expect.objectContaining({
        provider: 'google',
        error_code: 'identity_already_exists',
      }),
    );
  });

  it('prompts guests to connect an account only after repeated copied replies', async () => {
    signInAnonymously.mockResolvedValueOnce({
      data: { session: guestSession },
      error: null,
    });

    render(<App />);

    await screen.findByText('Prueba gratis');
    expect(screen.queryByText(/Guarda tus respuestas/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mensaje o idea'), {
      target: { value: 'me pasas el update?' },
    });
    fireEvent.click(screen.getByTitle('Generar respuesta'));

    await waitFor(() =>
      expect(screen.getAllByText('Hi, can you send me the update?').length).toBeGreaterThan(0),
    );

    const resultCopyButton = () => screen.getByTitle('Copiar respuesta');
    fireEvent.click(resultCopyButton());
    fireEvent.click(resultCopyButton());

    expect(await screen.findByText(/Guarda tus respuestas/i)).toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith(
      'account_connect_prompt_shown',
      expect.objectContaining({
        surface: 'translate_soft_banner',
        reason: 'copied_replies',
      }),
    );
  });
});
