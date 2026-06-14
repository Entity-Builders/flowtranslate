import {
  useSupabaseAccountAccess,
  type EntityBuildersAccountKind,
  type SupabaseAuthAccessClient,
} from '@eb-packages/auth';
import { useCallback, useEffect, useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import {
  mapAccountKindToBillingState,
  resolveFlowtranslateBillingState,
  type FlowtranslateBillingState,
  type FlowtranslateEntitlementRow,
  type Profile,
} from '@eb-packages/flowtranslate-core';
import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import { analytics } from '../services/analytics';

export type FlowtranslateAccountKind = EntityBuildersAccountKind;

const FLOWTRANSLATE_AUTH_MESSAGES = {
  supabaseNotConfigured: 'Supabase no esta configurado en este entorno.',
  missingEmail: 'Ingresa un email para continuar.',
  missingCredentials: 'Ingresa el email y el codigo.',
  codeSent: 'Revisa tu email e ingresa el codigo aca.',
  connected: 'Cuenta conectada.',
  guestReady: 'Tu prueba gratis esta lista.',
  oauthStarted: 'Continua con Google para terminar el inicio de sesion.',
  oauthFailed: 'No pudimos terminar el inicio con Google. Proba de nuevo.',
  oauthLinkedIdentityError:
    'Ese Google ya esta conectado a otra cuenta. Tu prueba gratis sigue activa; usa codigo por email o entra con otra cuenta.',
};

export const useFlowtranslateAccount = () => {
  const account = useSupabaseAccountAccess({
    client: supabase as unknown as SupabaseAuthAccessClient | null,
    isConfigured: isSupabaseConfigured,
    analytics,
    messages: FLOWTRANSLATE_AUTH_MESSAGES,
    redirectTo: () => window.location.origin,
  });
  const { signInWithOAuth } = account;
  const sessionUser = account.session?.user;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billingState, setBillingState] = useState<FlowtranslateBillingState>(
    () => mapAccountKindToBillingState('none'),
  );
  const [billingStateLoading, setBillingStateLoading] = useState(false);

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

  const signInWithGoogle = useCallback(
    async () => signInWithOAuth('google' as Provider),
    [signInWithOAuth],
  );

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

  return {
    ...account,
    profile,
    billingState,
    billingStateLoading,
    displayName:
      account.accountKind === 'guest'
        ? 'Prueba gratis'
        : account.session?.user.email || 'Cuenta',
    currentStreak: profile?.current_streak || 0,
    globalContext: profile?.global_context || '',
    updateGlobalContext,
    signInWithGoogle,
  };
};
