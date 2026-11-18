import { assessQuality } from './quality.js';

/**
 * Informational evaluation only. Reassesses the selected data; never trusts a supplied quality/eligible flag.
 * There is no runtime context, AI call, clock access or trading-path integration here.
 * @param {unknown} observation
 * @param {unknown} requirements
 * @param {number} nowMs
 * @returns {import('./contracts.js').EligibilityDecision}
 */
function evaluateEligibility(observation, requirements, nowMs) {
  const quality = assessQuality(observation, requirements, nowMs);
  const purposes = ['DISPLAY', 'CLOSED_BAR_RESEARCH', 'LIVE_SIGNAL_ANALYSIS', 'EXECUTION'];
  const purpose = purposes.includes(requirements?.purpose) ? requirements.purpose : null;
  const reasons = [...quality.reasons];
  // Only diagnostic/research assessments are permitted by this increment's fixed policy.
  // This cannot be relaxed by a requirement, serialized report or client trust flag.
  if (purpose === 'LIVE_SIGNAL_ANALYSIS' || purpose === 'EXECUTION') {
    reasons.push({ code: 'PURPOSE_NOT_APPROVED', category: 'ELIGIBILITY',
      publicMessage: 'Live signal analysis and execution are not approved in this increment.' });
  }
  if (purpose === 'CLOSED_BAR_RESEARCH' && requirements.allowOpenBar !== false) {
    reasons.push({ code: 'RESEARCH_REQUIRES_CLOSED_BARS', category: 'ELIGIBILITY', publicMessage: 'Research requires a closed-bar window.' });
  }
  return {
    schemaVersion: 1, policyVersion: 'mde-phase3b-increment1', purpose, snapshotId: quality.snapshotId,
    status: quality.status === 'PASS' && reasons.length === 0 ? 'ALLOWED' : 'DENIED',
    grantsRuntimeAccess: false, reasons, quality
  };
}

export { evaluateEligibility };
