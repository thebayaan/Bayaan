// @ai-generated
// Jest automatically uses node-module mocks placed under a root-level __mocks__
// directory. Loading the real SDK in a suite is slow and leaves open handles,
// so modules that report to Sentry (e.g. utils/storage, through the persisted
// zustand stores) get these no-op stubs instead. A suite that asserts on a
// report can still override this with its own jest.mock factory.
module.exports = {
  init: jest.fn(),
  wrap: jest.fn(component => component),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
};
