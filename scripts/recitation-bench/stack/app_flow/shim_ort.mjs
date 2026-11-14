/* eslint-env node, es2020 */
import {createRequire} from 'node:module';
const require = createRequire(
  new URL('../../../package.json', import.meta.url).pathname,
);
const ort = require('onnxruntime-node');
export const Tensor = ort.Tensor;
export const InferenceSession = {
  create: file =>
    ort.InferenceSession.create(file, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
    }),
};
