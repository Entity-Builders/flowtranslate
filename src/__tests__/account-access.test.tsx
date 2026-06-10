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
  });

  it('starts an anonymous guest session on first load without opening the account modal', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument();
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

    expect(await screen.findByText('Guest trial')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('offers Google, guest trial, and progressive email code sign-in', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Account'));

    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try guest trial/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /use email code/i }));

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'juan@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'juan@example.com',
      options: {
        emailRedirectTo: window.location.origin,
      },
    }));
    expect(await screen.findByLabelText(/code/i)).toBeInTheDocument();
  });

  it('starts guest auth and Google OAuth from the account modal', async () => {
    render(<App />);

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle('Account'));
    fireEvent.click(
      await screen.findByRole('button', { name: /continue with google/i }),
    );

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    }));

    fireEvent.click(screen.getByRole('button', { name: /try guest trial/i }));

    await waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(2));
    expect(analyticsTrack).toHaveBeenCalledWith('auth_guest_submitted', {
      method: 'anonymous',
      source: 'manual',
    });
  });

  it('links Google identity when the current session is a guest', async () => {
    getSession.mockResolvedValue({ data: { session: guestSession } });

    render(<App />);

    fireEvent.click(await screen.findByTitle('Account'));
    fireEvent.click(
      await screen.findByRole('button', { name: /connect with google/i }),
    );

    await waitFor(() => expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    }));
    expect(screen.getAllByText(/guest trial/i).length).toBeGreaterThan(1);
  });
});
