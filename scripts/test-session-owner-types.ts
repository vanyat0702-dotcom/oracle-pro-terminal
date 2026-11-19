// Compile-only. No public factory can mint even a MODEL_ONLY handle.
import { getAnalysisSessionOwner } from '../core/runtime/sessionOwner.js';
import type { ModelSessionHandle, ModelSessionView, ModelSessionBinding } from '../core/runtime/sessionOwner.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';
import type { AnalysisSession } from '../core/runtime/contracts.js';
declare const handle: ModelSessionHandle;
declare const view: ModelSessionView;
declare const binding: ModelSessionBinding;
declare const rawModel: AnalysisSession;
const owner = getAnalysisSessionOwner();
const creation = owner.create(null);
const denial: 'DENIED' = creation.status;
const noCreation: false = creation.ok;
const noGrant: false = owner.consume(handle, 0).grantsRuntimeAccess;
owner.transition(handle, { stage: 'ANALYSIS', expectedRevision: 1 });
owner.transition(handle, { stage: 'OPENAI', expectedRevision: 2 }); // Representable, runtime closed until 4F.
owner.inspect(handle); owner.revoke(handle);
// @ts-expect-error No public dependency injection is accepted.
getAnalysisSessionOwner({ clock: () => 0 });
// @ts-expect-error There is no public registration/seed API.
owner.seed(rawModel, binding);
// @ts-expect-error There is no mutable current model in the public API.
owner.current = rawModel;
// @ts-expect-error Creation cannot accept a caller-supplied policy or clock.
owner.create({}, { policy: {}, clock: {} });
// @ts-expect-error Transition commands contain no policy, current or revocation overrides.
owner.transition(handle, { stage: 'ROOT', expectedRevision: 0, revoked: false });
// @ts-expect-error DTOs are not identity handles.
const dtoHandle: ModelSessionHandle = view;
// @ts-expect-error Handles are not runtime permissions.
const context: RuntimeContext = handle;
// @ts-expect-error MODEL_ONLY views cannot carry positive grants.
const positive: true = view.grantsRuntimeAccess;
// @ts-expect-error Returned lifecycle data is immutable.
view.revision = 0;
// @ts-expect-error Nested DTOs are immutable too.
view.scope.snapshotId = 'forged';
// @ts-expect-error Evidence binding cannot be modified through its type.
binding.originalObservations.push(binding.originalObservations[0]);
void [denial, noCreation, noGrant, dtoHandle, context, positive];
