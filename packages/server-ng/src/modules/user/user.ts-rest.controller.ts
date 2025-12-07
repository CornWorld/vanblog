import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, type User as ContractUser } from '@vanblog/shared';
import { Request } from 'express';

import { UserType } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

function toContractUser(user: User): ContractUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    email: user.email,
    permissions: user.permissions ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Controller()
export class UserTsRestController {
  constructor(private readonly userService: UserService) {}

  @TsRestHandler(contract.updateProfile)
  updateProfile(@Req() req: Request): unknown {
    type AuthRequest = Request & { user?: { id: number } };
    return tsRestHandler(contract.updateProfile, async ({ body }) => {
      const authUser = (req as AuthRequest).user;
      if (!authUser) {
        return { status: 401, body: { message: 'Unauthorized' } as unknown as never };
      }

      const updatedUser = await this.userService.update(authUser.id, {
        nickname: body.nickname,
        email: body.email,
        password: body.password,
        avatar: body.avatar,
      });

      return { status: 200, body: toContractUser(updatedUser) };
    });
  }

  @TsRestHandler(contract.getCollaborators)
  getCollaborators(): unknown {
    return tsRestHandler(contract.getCollaborators, async () => {
      const collaborators = await this.userService.getCollaborators();
      return { status: 200, body: collaborators.map(toContractUser) };
    });
  }

  @TsRestHandler(contract.createCollaborator)
  createCollaborator(): unknown {
    return tsRestHandler(contract.createCollaborator, async ({ body }) => {
      const newUser = await this.userService.create({
        username: (body as { name: string }).name,
        password: (body as { password: string }).password,
        nickname: body.nickname,
        type: UserType.EDITOR,
        permissions: body.permissions,
      });
      return { status: 201, body: toContractUser(newUser) };
    });
  }

  @TsRestHandler(contract.updateCollaborator)
  updateCollaborator(): unknown {
    return tsRestHandler(contract.updateCollaborator, async ({ body }) => {
      const updatedUser = await this.userService.update((body as { id: number }).id, {
        password: body.password,
        nickname: body.nickname,
        permissions: body.permissions,
      });
      return { status: 200, body: toContractUser(updatedUser) };
    });
  }

  @TsRestHandler(contract.deleteCollaborator)
  deleteCollaborator(): unknown {
    return tsRestHandler(contract.deleteCollaborator, async ({ params }) => {
      await this.userService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }
}
