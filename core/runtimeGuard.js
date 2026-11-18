// Server-side deny-only guard. No policy override, env switch, test grant or positive issuer.
// Identity is process-local; JSON, client fields and public decisions cannot register contexts.
const contexts = new WeakSet();
const DENIED = Object.freeze({ allowed: false, code: 'RUNTIME_GUARD_DENIED',
  publicMessage: 'Trading analysis is disabled: no live runtime access is available.' });

function createUnprivilegedContext() {
  const context = Object.freeze(Object.create(null));
  contexts.add(context);
  return context;
}

function checkRuntimeAccess(context) {
  // WeakSet identity lookup never reads properties, getters or proxy traps on the input.
  if (!contexts.has(context)) return DENIED;
  // Even genuine contexts have no live privileges in this increment.
  return DENIED;
}

function runtimeGuardSkip() {
  // Never inspect or echo a rejected payload/context, choose prices, pairs or random IDs.
  return Object.freeze({ signal: 'SKIP', confidence: 0, tradeId: 0,
    reasoning: DENIED.publicMessage,
    skipReason: Object.freeze({ code: DENIED.code, category: 'ELIGIBILITY', publicMessage: DENIED.publicMessage }) });
}

export { createUnprivilegedContext, checkRuntimeAccess, runtimeGuardSkip };
