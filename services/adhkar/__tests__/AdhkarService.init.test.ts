// initialize routes a data version change through the single-transaction
// reseed and retries it on the next call after a failure.
jest.mock('@/services/database/AdhkarDatabaseService', () => ({
  adhkarDatabaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    needsReseed: jest.fn().mockResolvedValue(true),
    isDatabaseSeeded: jest.fn().mockResolvedValue(true),
    areSuperCategoriesSeeded: jest.fn().mockResolvedValue(true),
    seedDatabase: jest.fn().mockResolvedValue(undefined),
    seedSuperCategories: jest.fn().mockResolvedValue(undefined),
    reseed: jest.fn().mockResolvedValue(undefined),
  },
}));
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import adhkarSeed from '@/data/adhkar.json';

type Service = typeof import('../AdhkarService').adhkarService;

// A fresh AdhkarService singleton (its init promise is per instance), sharing
// the mocked database service above.
function freshService(): Service {
  let service: Service | undefined;
  jest.isolateModules(() => {
    service = require('../AdhkarService').adhkarService;
  });
  if (!service) throw new Error('AdhkarService did not load');
  return service;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(adhkarDatabaseService.needsReseed).mockResolvedValue(true);
  jest.mocked(adhkarDatabaseService.reseed).mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('AdhkarService.initialize', () => {
  it('reseeds content, super categories and version in one call', async () => {
    await freshService().initialize();
    expect(adhkarDatabaseService.reseed).toHaveBeenCalledTimes(1);
    expect(adhkarDatabaseService.reseed).toHaveBeenCalledWith(
      expect.objectContaining({categories: adhkarSeed.categories}),
      adhkarSeed.super_category_dhikr_ids,
      adhkarSeed.super_category_audio_overrides,
    );
    expect(adhkarDatabaseService.seedDatabase).not.toHaveBeenCalled();
    expect(adhkarDatabaseService.seedSuperCategories).not.toHaveBeenCalled();
  });

  it('retries the reseed on the next call after a failure', async () => {
    jest
      .mocked(adhkarDatabaseService.reseed)
      .mockRejectedValueOnce(new Error('disk full'));
    const service = freshService();
    await expect(service.initialize()).rejects.toThrow('disk full');
    await service.initialize();
    expect(adhkarDatabaseService.reseed).toHaveBeenCalledTimes(2);
    expect(adhkarDatabaseService.needsReseed).toHaveBeenCalledTimes(2);
  });

  it('seeds only empty tables when the version is current', async () => {
    jest.mocked(adhkarDatabaseService.needsReseed).mockResolvedValue(false);
    jest
      .mocked(adhkarDatabaseService.isDatabaseSeeded)
      .mockResolvedValueOnce(false);
    await freshService().initialize();
    expect(adhkarDatabaseService.reseed).not.toHaveBeenCalled();
    expect(adhkarDatabaseService.seedDatabase).toHaveBeenCalledTimes(1);
    expect(adhkarDatabaseService.seedSuperCategories).not.toHaveBeenCalled();
  });
});
