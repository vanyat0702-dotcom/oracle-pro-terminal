import { getAnalysisSessionOwner } from '../core/runtime/sessionOwner.js';
import type { ModelSessionHandle } from '../core/runtime/sessionOwner.js';
import type { ModelStageHandle, ModelStageView, ModelStageResult } from '../core/runtime/stageContracts.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';
import type { AdapterPermitScope } from '../core/runtime/contracts.js';
declare const parent: ModelSessionHandle;
declare const stage: ModelStageHandle;
declare const view: ModelStageView;
declare const result: ModelStageResult;
const owner = getAnalysisSessionOwner();
owner.stages.consume(parent, stage, { stage: 'OPENAI', expectedRevision: 0 });
owner.stages.complete(parent, stage, { stage: 'GEMINI', expectedRevision: 1 });
const noGrant: false = result.grantsRuntimeAccess;
const denial: false = owner.stages.finalize(parent, stage, { stage: 'FINALIZATION', expectedRevision: 0 }).ok;
// @ts-expect-error No public stage registration.
owner.stages.create(parent, {});
// @ts-expect-error No production fixture injection.
owner.stages.seed(parent, {});
// @ts-expect-error No callbacks exposing parent records.
owner.stages.withParent(parent, () => {});
// @ts-expect-error Namespace is readonly.
owner.stages = {};
// @ts-expect-error A DTO cannot be used as a branded stage identity.
const forged: ModelStageHandle = view;
// @ts-expect-error Handles cannot authorize runtime AI.
const runtime: RuntimeContext = stage;
// @ts-expect-error There is no AdapterPermit in the model.
const permit: AdapterPermitScope = stage;
// @ts-expect-error No success/result flags are accepted.
owner.stages.complete(parent, stage, { stage: 'OPENAI', expectedRevision: 1, success: true });
// @ts-expect-error Invalid stage.
owner.stages.consume(parent, stage, { stage: 'AI', expectedRevision: 0 });
// @ts-expect-error No client TTL.
owner.stages.consume(parent, stage, { stage: 'GEMINI', expectedRevision: 0, expiresAtMs: 100 });
// @ts-expect-error Deep immutable projection.
view.deadline.expiresAtMs = 100;
// @ts-expect-error Deep immutable scope.
view.scope.policyFingerprint = 'forged';
// @ts-expect-error Model results cannot carry positive grants.
const grant: true = result.grantsRuntimeAccess;
void [noGrant, denial, forged, runtime, permit, grant];
