import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { InitController } from './init.controller';
import { InitService } from './init.service';

const mockInitService = {
  initializeCms: vi.fn(),
};

describe('InitController (Public)', () => {
  let controller: InitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InitController],
      providers: [{ provide: InitService, useValue: mockInitService }],
    }).compile();

    controller = module.get<InitController>(InitController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('init should pass body and wrap result', async () => {
    const body: any = { admin: { username: 'root', password: 'Aa123456!', nickname: 'Admin' } };
    const data: any = { initialized: true, admin: { id: 1, username: 'root' } };
    mockInitService.initializeCms.mockResolvedValue(data);

    const result = await controller.init(body);

    expect(mockInitService.initializeCms).toHaveBeenCalledWith(body);
    expect(result).toEqual({ statusCode: 200, data });
  });
});
