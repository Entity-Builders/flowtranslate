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
const startFlowtranslateProCheckout = vi.hoisted(() => vi.fn());
const profileMaybeSingle = vi.hoisted(() => vi.fn());
const profileUpdate = vi.hoisted(() => vi.fn());
const entitlementMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('../services/analytics', () => ({
  analytics: {
    screen: analyticsScreen,
    track: analyticsTrack,
  },
  safeCommercialAnalyticsProperties: (properties: Record<string, unknown>) => properties,
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
  startFlowtranslateProCheckout,
  generateLearningInsight: vi.fn(),
  generateStudyArticle: vi.fn(),
  askBreakdownQuestion: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  getFlowtranslateFunctionUrl: () => 'http://localhost/functions/v1/flowtranslate-generate',
  supabase: {
    from: (table: string) => {
      if (table !== 'profiles' && table !== 'entitlements') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain = {
        select: () => chain,
        update: profileUpdate,
        eq: () => chain,
        maybeSingle:
          table === 'profiles' ? profileMaybeSingle : entitlementMaybeSingle,
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
    window.history.replaceState({}, '', '/');
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
    entitlementMaybeSingle.mockResolvedValue({ data: null, error: null });
    startFlowtranslateProCheckout.mockResolvedValue({
      checkoutUrl: '#mercado-pago-checkout',
    });
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

  it('offers Google, guest trial, and email code sign-in as a visible fallback', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Cuenta'));

    expect(
      await screen.findByRole('button', { name: /continuar con google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /iniciar prueba gratis/i }),
    ).toBeInTheDocument();
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

  it('links Google OAuth from a guest session without signing out first', async () => {
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
    expect(signOut).not.toHaveBeenCalled();
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(analyticsTrack).toHaveBeenCalledWith(
      'auth_oauth_submitted',
      expect.objectContaining({
        method: 'google_oauth_from_guest',
      }),
    );
  });

  it('keeps email code available while a guest connects an account', async () => {
    getSession.mockResolvedValue({ data: { session: guestSession } });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Cuenta'));

    expect(
      await screen.findByRole('button', { name: /conectar con google/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

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
    expect(signOut).not.toHaveBeenCalled();
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

  it('keeps paid Pro pressure out of the early guest history prompt', async () => {
    signInAnonymously.mockResolvedValueOnce({
      data: { session: guestSession },
      error: null,
    });

    render(<App />);

    await screen.findByText('Prueba gratis');

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

    expect(await screen.findByText(/Conecta una cuenta gratis/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/ARS 4\.999\/mes/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/FlowTranslate Pro/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /guardar historial/i }));

    expect(startFlowtranslateProCheckout).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Cuenta' })).toBeInTheDocument();
    expect(analyticsTrack).toHaveBeenCalledWith(
      'account_connect_prompt_clicked',
      expect.objectContaining({
        surface: 'translate_soft_banner',
        reason: 'save_history',
        account_kind: 'guest',
      }),
    );
  });

  it('starts provider checkout from a permanent account Pro CTA', async () => {
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    profileMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'permanent-user',
        email: 'juan@example.com',
        global_context: 'Soy PM en una agencia.',
        current_streak: 0,
        last_study_date: null,
      },
      error: null,
    });

    render(<App />);

    expect(await screen.findByText('Perfil')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Perfil'));

    expect(
      (await screen.findAllByText(/preferencias reutilizables/i)).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /pasar a pro/i }));

    await waitFor(() =>
      expect(startFlowtranslateProCheckout).toHaveBeenCalledWith('permanent-token'),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe('#mercado-pago-checkout'),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'checkout_started',
      expect.objectContaining({
        surface: 'profile_preferences',
        provider: 'mercado_pago',
        plan_id: 'flowtranslate_pro',
      }),
    );
    const checkoutStartedCall = analyticsTrack.mock.calls.find(
      ([event]) => event === 'checkout_started',
    );
    expect(JSON.stringify(checkoutStartedCall)).not.toContain('juan@example.com');
  });

  it('shows active Pro entitlement state in account and quota UI', async () => {
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    profileMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'permanent-user',
        email: 'juan@example.com',
        global_context: 'Soy PM en una agencia.',
        current_streak: 0,
        last_study_date: null,
      },
      error: null,
    });
    entitlementMaybeSingle.mockResolvedValue({
      data: {
        status: 'active',
        account_kind: 'pro',
        source: 'mercado_pago',
        plan: 'pro',
        subscription_id: 'subscription-secret',
        active_from: '2026-06-01T00:00:00.000Z',
        active_until: null,
        last_verified_at: '2026-06-13T12:00:00.000Z',
      },
      error: null,
    });

    render(<App />);

    expect(await screen.findByText('Pro')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('FlowTranslate Pro'));

    expect((await screen.findAllByText('FlowTranslate Pro')).length).toBeGreaterThan(0);
    expect(screen.getByText(/tu pro esta activo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pasar a pro/i })).not.toBeInTheDocument();

    await waitFor(() =>
      expect(analyticsTrack).toHaveBeenCalledWith(
        'pro_entitlement_granted',
        expect.objectContaining({
          billing_state: 'pro_active',
          entitlement_verified: true,
        }),
      ),
    );

    const proCalls = analyticsTrack.mock.calls.filter(([event]) =>
      ['pro_entitlement_state_viewed', 'pro_entitlement_granted'].includes(
        String(event),
      ),
    );
    const serializedCalls = JSON.stringify(proCalls);
    expect(serializedCalls).not.toContain('juan@example.com');
    expect(serializedCalls).not.toContain('subscription-secret');
    expect(serializedCalls).not.toContain('source_text');
    expect(serializedCalls).not.toContain('generated_text');
  });

  it('does not show first-run responder branding to active Pro accounts', async () => {
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    profileMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'permanent-user',
        email: 'juan@example.com',
        global_context: '',
        current_streak: 0,
        last_study_date: null,
      },
      error: null,
    });
    entitlementMaybeSingle.mockResolvedValue({
      data: {
        status: 'active',
        account_kind: 'pro',
        source: 'mercado_pago',
        plan: 'pro',
        subscription_id: 'subscription-secret',
        active_from: '2026-06-01T00:00:00.000Z',
        active_until: null,
        last_verified_at: '2026-06-13T12:00:00.000Z',
      },
      error: null,
    });

    render(<App />);

    expect(await screen.findByText('Pro')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje o idea')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: /tu respuesta en ingles para trabajo, lista para mandar/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/probalo sin cuenta/i)).not.toBeInTheDocument();
  });

  it('shows pending Pro entitlement state with a checkout retry path', async () => {
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    entitlementMaybeSingle.mockResolvedValue({
      data: {
        status: 'pending',
        account_kind: 'pro',
        source: 'mercado_pago',
        plan: 'pro',
        subscription_id: 'subscription-secret',
        active_from: null,
        active_until: null,
        last_verified_at: null,
      },
      error: null,
    });

    render(<App />);

    expect(await screen.findByText('Perfil')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Perfil'));

    expect((await screen.findAllByText('Pro pendiente')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/si abandonaste el checkout, podes reintentarlo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reintentar checkout/i }),
    ).toBeInTheDocument();
  });

  it('shows safe checkout return success without granting Pro from URL params', async () => {
    window.history.pushState(
      {},
      '',
      '/pro/checkout/return?status=approved&payment_id=pay_secret&merchant_order_id=order_secret&external_reference=entitybuilders:flowtranslate:pro:checkout_secret',
    );
    getSession.mockResolvedValue({ data: { session: permanentSession } });

    render(<App />);

    expect(await screen.findByText(/volviste de mercado pago/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pro se activa cuando mercado pago confirma/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pay_secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/order_secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/checkout_secret/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(analyticsTrack).toHaveBeenCalledWith(
        'checkout_returned',
        expect.objectContaining({
          checkout_return_state: 'success',
          provider_status: 'approved',
          has_provider_reference: true,
          has_external_reference: true,
        }),
      ),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'payment_succeeded',
      expect.objectContaining({
        checkout_return_state: 'success',
        entitlement_verified: false,
      }),
    );

    const checkoutCalls = analyticsTrack.mock.calls.filter(([event]) =>
      ['checkout_returned', 'payment_succeeded'].includes(String(event)),
    );
    const serializedCalls = JSON.stringify(checkoutCalls);
    expect(serializedCalls).not.toContain('pay_secret');
    expect(serializedCalls).not.toContain('order_secret');
    expect(serializedCalls).not.toContain('checkout_secret');
    expect(serializedCalls).not.toContain('juan@example.com');
    expect(serializedCalls).not.toContain('source_text');
    expect(serializedCalls).not.toContain('generated_text');
    expect(serializedCalls).not.toContain('card_token');
  });

  it('shows pending, failed, and cancelled checkout return copy in Spanish', async () => {
    const cases = [
      [
        '/pro/checkout/return?status=pending',
        /estamos esperando la confirmacion de mercado pago/i,
      ],
      [
        '/pro/checkout/return?status=rejected',
        /no pudimos confirmar el pago/i,
      ],
      [
        '/pro/checkout/return?status=cancelled',
        /el checkout fue cancelado/i,
      ],
    ] as const;

    for (const [url, copy] of cases) {
      window.history.replaceState({}, '', url);
      const { unmount } = render(<App />);
      expect(await screen.findByText(copy)).toBeInTheDocument();
      unmount();
    }
  });
});
