import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

const mockTimelineService = {
  getTimeline: vi.fn(),
};

describe('TimelineController (Public)', () => {
  let controller: TimelineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelineController],
      providers: [{ provide: TimelineService, useValue: mockTimelineService }],
    }).compile();

    controller = module.get<TimelineController>(TimelineController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getTimeline should pass includeHidden flag and wrap result', async () => {
    const data = { years: [] } as any;
    mockTimelineService.getTimeline.mockResolvedValue(data);

    const result = await controller.getTimeline({ includeHidden: true } as any);

    expect(mockTimelineService.getTimeline).toHaveBeenCalledWith(true);
    expect(result).toEqual({ statusCode: 200, data });
  });
});
