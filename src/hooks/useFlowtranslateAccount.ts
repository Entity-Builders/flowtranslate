import {
  useSupabaseAccountAccess,
  type EntityBuildersAccountKind,
  type SupabaseAuthAccessClient,
} from '@entity-builders/auth';
import { useEffect, useState } from 'react';
import {
  mapAccountKindToBillingState,
  resolveFlowtranslateBillingState,
  type FlowtranslateBillingState,
  type FlowtranslateEntitlementRow,
  type Profile,
} from '@entity-builders/flowtranslate-core';
import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import { flowtranslateAuthConfig } from '../lib/auth-config';
import { analytics } from '../services/analytics';
import { syncGuestAccount } from '../services/flowtranslate-api';
import { STORAGE_KEYS } from '../constants';

export type FlowtranslateAccountKind = EntityBuildersAccountKind;

const FLOWTRANSLATE_AUTH_MESSAGES = {
  supabaseNotConfigured: 'Supabase no esta configurado en este entorno.',
  missingEmail: 'Ingresa un email para continuar.',
  missingCredentials: 'Ingresa el email y el codigo.',
  codeSent: 'Revisa tu email e ingresa el codigo aca.',
  connected: 'Cuenta conectada.',
  guestReady: 'Modo invitado listo.',
  oauthStarted: 'Continua con Google para terminar el inicio de sesion.',
  oauthFailed: 'No pudimos terminar el inicio con Google. Proba de nuevo.',
  oauthLinkedIdentityError:
    'Ese Google ya esta conectado a otra cuenta. Tu sesion temporal sigue activa; usa codigo por email o entra con otra cuenta.',
};

const readPendingGuestSyncUserId = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.pendingGuestSyncUserId) || '';
  } catch {
    return '';
  }
};

const writePendingGuestSyncUserId = (guestUserId: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.pendingGuestSyncUserId, guestUserId);
  } catch {
    // A blocked storage write should not erase the current guest session.
  }
};

const clearPendingGuestSyncUserId = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.pendingGuestSyncUserId);
  } catch {
    // Ignore storage cleanup failures; the sync effect is guarded in-memory.
  }
};

export const useFlowtranslateAccount = () => {
  const account = useSupabaseAccountAccess({
    client: supabase as unknown as SupabaseAuthAccessClient | null,
    isConfigured: isSupabaseConfigured,
    authConfig: flowtranslateAuthConfig,
    analytics,
    messages: FLOWTRANSLATE_AUTH_MESSAGES,
  });
  const sessionUser = account.session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billingState, setBillingState] = useState<FlowtranslateBillingState>(
    () => mapAccountKindToBillingState('none'),
  );
  const [billingStateLoading, setBillingStateLoading] = useState(false);
  const [guestSyncLoading, setGuestSyncLoading] = useState(false);
  const [guestSyncMessage, setGuestSyncMessage] = useState('');
  const [guestSyncError, setGuestSyncError] = useState('');
  const [guestSyncAttemptedFor, setGuestSyncAttemptedFor] = useState('');

  useEffect(() => {
    if (account.accountKind === 'permanent') return;

    setGuestSyncMessage('');
    setGuestSyncError('');
    if (account.accountKind === 'guest') {
      setGuestSyncAttemptedFor('');
    }
  }, [account.accountKind]);

  useEffect(() => {
    if (!supabase) return;

    if (!sessionUser) {
      setProfile(null);
      return;
    }

    let mounted = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', sessionUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setProfile(data as Profile);
      });

    return () => {
      mounted = false;
    };
  }, [sessionUser]);

  useEffect(() => {
    if (!supabase || !sessionUser || account.accountKind !== 'permanent') {
      setBillingState(mapAccountKindToBillingState(account.accountKind));
      setBillingStateLoading(false);
      return;
    }

    let mounted = true;
    const userId = sessionUser.id;
    setBillingStateLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('entitlements')
          .select(
            'status, account_kind, source, plan, subscription_id, active_from, active_until, last_verified_at',
          )
          .eq('user_id', userId)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          analytics.captureError(error, {
            screen: 'account',
            action: 'load_pro_entitlement_state',
            account_kind: account.accountKind,
            error_code: error.code || null,
          });
          analytics.track('pro_entitlement_state_load_failed', {
            account_kind: account.accountKind,
            error_type: error.name || 'entitlement_load_error',
            error_code: error.code || null,
          });
          setBillingState(mapAccountKindToBillingState(account.accountKind));
          return;
        }

        setBillingState(
          resolveFlowtranslateBillingState({
            accountKind: account.accountKind,
            entitlement: data as FlowtranslateEntitlementRow | null,
          }),
        );
      } catch (error) {
        if (!mounted) return;
        analytics.captureError(error, {
          screen: 'account',
          action: 'load_pro_entitlement_state',
          account_kind: account.accountKind,
        });
        analytics.track('pro_entitlement_state_load_failed', {
          account_kind: account.accountKind,
          error_type: error instanceof Error ? error.name : 'entitlement_load_error',
          error_code: null,
        });
        setBillingState(mapAccountKindToBillingState(account.accountKind));
      } finally {
        if (mounted) setBillingStateLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [account.accountKind, sessionUser]);

  useEffect(() => {
    if (
      !account.accessToken ||
      account.accountKind !== 'permanent' ||
      !sessionUser?.id
    ) {
      return;
    }

    const guestUserId = readPendingGuestSyncUserId();
    if (
      !guestUserId ||
      guestUserId === sessionUser.id ||
      guestSyncAttemptedFor === guestUserId
    ) {
      if (guestUserId === sessionUser.id) clearPendingGuestSyncUserId();
      return;
    }

    setGuestSyncAttemptedFor(guestUserId);
    setGuestSyncLoading(true);
    setGuestSyncMessage('');
    setGuestSyncError('');

    void syncGuestAccount({ guestUserId }, account.accessToken)
      .then((result) => {
        clearPendingGuestSyncUserId();
        const movedCount =
          result.translationRecordsMoved + result.usageEventsMoved;
        setGuestSyncMessage(
          movedCount > 0
            ? 'Historial temporal sincronizado con esta cuenta.'
            : 'No habia historial temporal nuevo para sincronizar.',
        );
        analytics.track('auth_guest_sync_succeeded', {
          account_kind: 'permanent',
          moved_translation_records: result.translationRecordsMoved,
          archived_duplicate_records:
            result.duplicateTranslationRecordsArchived,
          moved_usage_events: result.usageEventsMoved,
          moved_guest_identities: result.guestIdentitiesMoved,
        });
      })
      .catch((error) => {
        clearPendingGuestSyncUserId();
        analytics.captureError(error, {
          screen: 'account',
          action: 'sync_guest_account',
          account_kind: 'permanent',
        });
        analytics.track('auth_guest_sync_failed', {
          account_kind: 'permanent',
          error_type: error instanceof Error ? error.name : 'sync_error',
        });
        setGuestSyncError(
          'Entraste con Google, pero no pudimos sincronizar el historial temporal.',
        );
      })
      .finally(() => setGuestSyncLoading(false));
  }, [
    account.accessToken,
    account.accountKind,
    guestSyncAttemptedFor,
    sessionUser?.id,
  ]);

  const updateGlobalContext = async (context: string) => {
    if (!account.session?.user || !supabase) {
      return false;
    }

    const cleanContext = context.trim() || null;
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ global_context: cleanContext })
      .eq('user_id', account.session.user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      analytics.captureError(updateError, {
        screen: 'account',
        action: 'update_profile_context',
        account_kind: account.accountKind,
        error_code: updateError.code || null,
      });
      analytics.track('profile_context_update_failed', {
        account_kind: account.accountKind,
        error_type: updateError.name || 'profile_update_error',
        error_code: updateError.code || null,
      });
      return false;
    }

    if (data && !updateError) {
      setProfile(data as Profile);
    }

    analytics.track('profile_context_updated', {
      account_kind: account.accountKind,
      has_context: Boolean(cleanContext),
      context_chars: cleanContext?.length || 0,
    });
    return true;
  };

  const syncExistingGoogleAccount = async () => {
    const guestUserId = account.session?.user?.id;
    if (!guestUserId || account.accountKind !== 'guest') return false;

    writePendingGuestSyncUserId(guestUserId);
    setGuestSyncAttemptedFor('');
    setGuestSyncMessage('');
    setGuestSyncError('');
    analytics.track('auth_guest_sync_requested', {
      provider: 'google',
      account_kind: account.accountKind,
    });
    await account.signInWithOAuth('google', { forceSignIn: true });
    return true;
  };

  const canSyncExistingGoogleAccount = Boolean(
    account.isGuest &&
      account.oauthRecovery?.reason === 'identity_already_exists' &&
      account.oauthRecovery.provider === 'google',
  );

  return {
    ...account,
    profile,
    billingState,
    billingStateLoading,
    displayName:
      account.accountKind === 'guest'
        ? 'Invitado'
        : account.session?.user.email || 'Cuenta',
    message: guestSyncMessage || account.message,
    error: guestSyncError || account.error,
    currentStreak: profile?.current_streak || 0,
    globalContext: profile?.global_context || '',
    updateGlobalContext,
    authEntryConfig: flowtranslateAuthConfig,
    canSyncExistingGoogleAccount,
    syncExistingGoogleAccount,
    guestSyncLoading,
  };
};
