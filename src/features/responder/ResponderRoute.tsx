import type {
  LanguageCode,
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { X } from 'lucide-react';
import { ExpressionWorkspace } from '../../components/ExpressionWorkspace';
import {
  ProUpgradePrompt,
  type ProUpgradeSurface,
} from '../../components/ProUpgradePrompt';
import type { useBidirectionalTranslator } from '../../hooks/useBidirectionalTranslator';
import type { FlowtranslateAccountKind } from '../../hooks/useFlowtranslateAccount';

type CopiedTarget = 'input' | 'result' | null;
type Translator = ReturnType<typeof useBidirectionalTranslator>;
type UpgradePromptState = {
  busy: boolean;
  error: string;
};

type ResponderRouteProps = {
  accountKind: FlowtranslateAccountKind;
  copiedTarget: CopiedTarget;
  dictatingLanguage: LanguageCode | null;
  dictationAvailable: boolean;
  dictationUnavailableReason: string;
  expressionStatusText?: string;
  history: TranslationRecord[];
  shouldReserveMobileResultSheet: boolean;
  shouldShowAccountPrompt: boolean;
  shouldShowSavedHistoryUpgradePrompt: boolean;
  shouldShowUsageUpgradePrompt: boolean;
  shouldSuppressResponderPromise: boolean;
  speakingLanguage: LanguageCode | null;
  speechAvailable: boolean;
  translator: Translator;
  usage: UsageSnapshot | null;
  voiceMessage: string;
  quotaUpgradeBusy: boolean;
  quotaUpgradeLabel: string;
  onConnectAccountForPro: (surface: ProUpgradeSurface) => void;
  onCopyInput: () => void;
  onCopyResult: () => void;
  onDictateInput: () => void;
  onDismissAccountPrompt: () => void;
  onDismissUpgradePrompt: (surface: ProUpgradeSurface) => void;
  onListenInput: () => void;
  onListenResult: () => void;
  onOpenAccountFromPrompt: (reason?: string) => void;
  onOpenLearning: () => void;
  onQuotaSupport: () => void;
  onQuotaUpgrade: () => void;
  onSelectPreset: (presetId: TranslationPresetId) => void;
  onStartProCheckout: (surface: ProUpgradeSurface) => void;
  onRequestStudy: (record: TranslationRecord) => void;
  upgradePromptState: (surface: ProUpgradeSurface) => UpgradePromptState;
};

export const ResponderRoute = ({
  accountKind,
  copiedTarget,
  dictatingLanguage,
  dictationAvailable,
  dictationUnavailableReason,
  expressionStatusText,
  history,
  shouldReserveMobileResultSheet,
  shouldShowAccountPrompt,
  shouldShowSavedHistoryUpgradePrompt,
  shouldShowUsageUpgradePrompt,
  shouldSuppressResponderPromise,
  speakingLanguage,
  speechAvailable,
  translator,
  usage,
  voiceMessage,
  quotaUpgradeBusy,
  quotaUpgradeLabel,
  onConnectAccountForPro,
  onCopyInput,
  onCopyResult,
  onDictateInput,
  onDismissAccountPrompt,
  onDismissUpgradePrompt,
  onListenInput,
  onListenResult,
  onOpenAccountFromPrompt,
  onOpenLearning,
  onQuotaSupport,
  onQuotaUpgrade,
  onSelectPreset,
  onStartProCheckout,
  onRequestStudy,
  upgradePromptState,
}: ResponderRouteProps) => (
  <main
    className={`flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-3 sm:p-4 ${
      shouldReserveMobileResultSheet ? 'pb-28 sm:pb-32 lg:pb-4' : ''
    }`}
  >
    {voiceMessage ? (
      <div className='border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800'>
        {voiceMessage}
      </div>
    ) : null}

    <ExpressionWorkspace
      inputText={translator.inputText}
      resultText={translator.resultText}
      mode={translator.mode}
      modeDetection={translator.modeDetection}
      sourceLanguage={translator.sourceLanguage}
      targetLanguage={translator.targetLanguage}
      presetId={translator.presetId}
      breakdown={translator.breakdown}
      breakdownStatus={translator.breakdownStatus}
      grammarInsight={translator.grammarInsight}
      translationRecordId={translator.translationRecordId}
      status={translator.status}
      canTranslate={translator.canTranslate}
      translateDisabledReason={translator.translateDisabledReason}
      copiedInput={copiedTarget === 'input'}
      copiedResult={copiedTarget === 'result'}
      canListen={speechAvailable}
      speakingLanguage={speakingLanguage}
      canDictate={dictationAvailable}
      dictatingLanguage={dictatingLanguage}
      dictationUnavailableReason={dictationUnavailableReason}
      statusText={expressionStatusText}
      quotaUsage={usage}
      quotaUpgradeLabel={quotaUpgradeLabel}
      quotaUpgradeBusy={quotaUpgradeBusy}
      hasSeenResponderPromise={shouldSuppressResponderPromise}
      onInputChange={(value) => translator.editInput(value)}
      onCopyInput={onCopyInput}
      onCopyResult={onCopyResult}
      onListenInput={onListenInput}
      onListenResult={onListenResult}
      onDictateInput={onDictateInput}
      onTranslate={() => void translator.translate()}
      onSelectPreset={onSelectPreset}
      onRequestBreakdown={() => translator.requestBreakdown()}
      onRequestStudy={() => {
        if (!translator.translationRecordId) return;
        const record = history.find((item) => item.id === translator.translationRecordId);
        if (record) onRequestStudy(record);
      }}
      onTranslateToSpanish={() => void translator.translateInputToSpanish()}
      onOpenAccount={() => onOpenAccountFromPrompt('post_copy_nudge')}
      onOpenLearning={onOpenLearning}
      postCopyAccountLabel={
        accountKind === 'guest' ? 'Crear cuenta gratis' : 'Ver perfil'
      }
      onQuotaUpgrade={onQuotaUpgrade}
      onQuotaSupport={onQuotaSupport}
    />

    {shouldShowAccountPrompt ? (
      <div className='flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <p className='font-bold text-slate-950'>
            Guarda tus respuestas y aprende con tus mensajes reales.
          </p>
          <p className='mt-1 leading-5 text-slate-600'>
            Conecta una cuenta para conservar historial, reutilizar buenas
            respuestas y desbloquear Learning personal.
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <button
            type='button'
            onClick={() => onOpenAccountFromPrompt('save_history')}
            className='inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
          >
            Guardar historial
          </button>
          <button
            type='button'
            onClick={onDismissAccountPrompt}
            className='inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            title='Ocultar'
            aria-label='Ocultar invitacion a cuenta'
          >
            <X size={16} />
          </button>
        </div>
      </div>
    ) : null}

    {shouldShowSavedHistoryUpgradePrompt ? (
      <ProUpgradePrompt
        surface='saved_history'
        accountKind={accountKind}
        compact={shouldReserveMobileResultSheet}
        onDismiss={() => onDismissUpgradePrompt('saved_history')}
        onStartCheckout={onStartProCheckout}
        onConnectAccount={onConnectAccountForPro}
        {...upgradePromptState('saved_history')}
      />
    ) : null}

    {shouldShowUsageUpgradePrompt ? (
      <ProUpgradePrompt
        surface='usage_limit'
        accountKind={accountKind}
        compact={shouldReserveMobileResultSheet}
        onDismiss={() => onDismissUpgradePrompt('usage_limit')}
        onStartCheckout={onStartProCheckout}
        onConnectAccount={onConnectAccountForPro}
        {...upgradePromptState('usage_limit')}
      />
    ) : null}
    <p className='max-w-[calc(100vw-2rem)] break-words text-xs text-slate-500 sm:max-w-full'>
      Los servicios de voz del navegador pueden procesar audio durante el
      dictado; Flowtranslate guarda solo el texto que envias y tu historial.
    </p>
  </main>
);
