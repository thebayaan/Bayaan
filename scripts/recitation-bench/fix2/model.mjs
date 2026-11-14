/* eslint-env node, es2020 */
// The checker model for the fix2 scripts: judge/model.mjs, with the runtime's memory
// arena off unless ORT_ARENA says otherwise, as the app runs it. judge/model.mjs throws
// on corrupted output; on x86-64 point ORT_NODE_DIR at a newer onnxruntime-node (see
// the README).
process.env.ORT_ARENA ??= '0';

export {loadModel, sliceFrames, MODEL_DIR, VOCAB} from '../judge/model.mjs';
export {fbank, NUM_BINS} from '../judge/fbank.mjs';
