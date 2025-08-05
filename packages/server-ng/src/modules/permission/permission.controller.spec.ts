import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import type {
  CreatePermissionNodeDto,
  UpdatePermissionNodeDto,
  PermissionNodeQueryDto,
  PermissionNodeDto,
} from './dto/permission-node.dto';
import type {
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  PermissionGroupQueryDto,
  PermissionGroupDto,
} from './dto/permission-group.dto';

describe('PermissionController', () => {
  let controller: PermissionController;
  let service: PermissionService;

  const mockPermissionNode: PermissionNodeDto = {
    id: 1,
    name: 'article:read',
    description: 'Read articles',
    module: 'article',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPermissionGroup: PermissionGroupDto = {
    id: 1,
    name: 'admin',
    description: 'Administrator group',
    permissions: ['article:read', 'article:write'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPermissionService = {
    createPermissionNode: vi.fn(),
    findAllPermissionNodes: vi.fn(),
    findPermissionNodeById: vi.fn(),
    updatePermissionNode: vi.fn(),
    removePermissionNode: vi.fn(),
    createPermissionGroup: vi.fn(),
    findAllPermissionGroups: vi.fn(),
    findPermissionGroupById: vi.fn(),
    updatePermissionGroup: vi.fn(),
    removePermissionGroup: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionController],
      providers: [
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    controller = module.get<PermissionController>(PermissionController);
    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission Node Management', () => {
    describe('createPermissionNode', () => {
      it('should create a new permission node', async () => {
        const createDto: CreatePermissionNodeDto = {
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        };

        mockPermissionService.createPermissionNode.mockResolvedValue(mockPermissionNode);

        const result = await controller.createPermissionNode(createDto);

        expect(service.createPermissionNode).toHaveBeenCalledWith(createDto);
        expect(result).toEqual(mockPermissionNode);
      });
    });

    describe('findAllPermissionNodes', () => {
      it('should return all permission nodes', async () => {
        const query: PermissionNodeQueryDto = {
          page: 1,
          limit: 10,
        };

        mockPermissionService.findAllPermissionNodes.mockResolvedValue([mockPermissionNode]);

        const result = await controller.findAllPermissionNodes(query);

        expect(service.findAllPermissionNodes).toHaveBeenCalledWith(query);
        expect(result).toEqual([mockPermissionNode]);
      });

      it('should filter by module', async () => {
        const query: PermissionNodeQueryDto = {
          module: 'article',
          page: 1,
          limit: 10,
        };

        mockPermissionService.findAllPermissionNodes.mockResolvedValue([mockPermissionNode]);

        const result = await controller.findAllPermissionNodes(query);

        expect(service.findAllPermissionNodes).toHaveBeenCalledWith(query);
        expect(result).toEqual([mockPermissionNode]);
      });
    });

    describe('findPermissionNodeById', () => {
      it('should return a permission node by id', async () => {
        const id = 1;
        mockPermissionService.findPermissionNodeById.mockResolvedValue(mockPermissionNode);

        const result = await controller.findPermissionNodeById(id);

        expect(service.findPermissionNodeById).toHaveBeenCalledWith(id);
        expect(result).toEqual(mockPermissionNode);
      });
    });

    describe('updatePermissionNode', () => {
      it('should update a permission node', async () => {
        const id = 1;
        const updateDto: UpdatePermissionNodeDto = {
          description: 'Updated description',
        };

        const updatedNode = Object.assign({}, mockPermissionNode, {
          description: 'Updated description',
        });
        mockPermissionService.updatePermissionNode.mockResolvedValue(updatedNode);

        const result = await controller.updatePermissionNode(id, updateDto);

        expect(service.updatePermissionNode).toHaveBeenCalledWith(id, updateDto);
        expect(result).toEqual(updatedNode);
      });
    });

    describe('removePermissionNode', () => {
      it('should remove a permission node', async () => {
        const id = 1;
        mockPermissionService.removePermissionNode.mockResolvedValue(undefined);

        await controller.removePermissionNode(id);

        expect(service.removePermissionNode).toHaveBeenCalledWith(id);
      });
    });
  });

  describe('Permission Group Management', () => {
    describe('createPermissionGroup', () => {
      it('should create a new permission group', async () => {
        const createDto: CreatePermissionGroupDto = {
          name: 'admin',
          description: 'Administrator group',
          permissions: JSON.stringify(['article:read', 'article:write']),
        };

        mockPermissionService.createPermissionGroup.mockResolvedValue(mockPermissionGroup);

        const result = await controller.createPermissionGroup(createDto);

        expect(service.createPermissionGroup).toHaveBeenCalledWith(createDto);
        expect(result).toEqual(mockPermissionGroup);
      });
    });

    describe('findAllPermissionGroups', () => {
      it('should return all permission groups', async () => {
        const query: PermissionGroupQueryDto = {
          page: 1,
          limit: 10,
        };

        mockPermissionService.findAllPermissionGroups.mockResolvedValue([mockPermissionGroup]);

        const result = await controller.findAllPermissionGroups(query);

        expect(service.findAllPermissionGroups).toHaveBeenCalledWith(query);
        expect(result).toEqual([mockPermissionGroup]);
      });
    });

    describe('findPermissionGroupById', () => {
      it('should return a permission group by id', async () => {
        const id = 1;
        mockPermissionService.findPermissionGroupById.mockResolvedValue(mockPermissionGroup);

        const result = await controller.findPermissionGroupById(id);

        expect(service.findPermissionGroupById).toHaveBeenCalledWith(id);
        expect(result).toEqual(mockPermissionGroup);
      });
    });

    describe('updatePermissionGroup', () => {
      it('should update a permission group', async () => {
        const id = 1;
        const updateDto: UpdatePermissionGroupDto = {
          description: 'Updated description',
        };

        const updatedGroup = Object.assign({}, mockPermissionGroup, {
          description: 'Updated description',
        });
        mockPermissionService.updatePermissionGroup.mockResolvedValue(updatedGroup);

        const result = await controller.updatePermissionGroup(id, updateDto);

        expect(service.updatePermissionGroup).toHaveBeenCalledWith(id, updateDto);
        expect(result).toEqual(updatedGroup);
      });
    });

    describe('removePermissionGroup', () => {
      it('should remove a permission group', async () => {
        const id = 1;
        mockPermissionService.removePermissionGroup.mockResolvedValue(undefined);

        await controller.removePermissionGroup(id);

        expect(service.removePermissionGroup).toHaveBeenCalledWith(id);
      });
    });
  });
});
