import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { Request } from 'express';

import { UserType } from './dto/create-user.dto';
import { UserService } from './user.service';

@Controller()
export class UserTsRestController {
  constructor(private readonly userService: UserService) {}

  @TsRestHandler(contract.updateProfile)
  updateProfile(@Req() req: Request): ReturnType<typeof tsRestHandler> {
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

      return { status: 200, body: updatedUser };
    });
  }

  @TsRestHandler(contract.getCollaborators)
  getCollaborators(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCollaborators, async () => {
      const collaborators = await this.userService.getCollaborators();
      return { status: 200, body: collaborators };
    });
  }

  @TsRestHandler(contract.createCollaborator)
  createCollaborator(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createCollaborator, async ({ body }) => {
      const newUser = await this.userService.create({
        username: (body as { name: string }).name,
        password: (body as { password: string }).password,
        nickname: body.nickname,
        type: UserType.EDITOR,
        permissions: body.permissions,
      });
      return { status: 201, body: newUser };
    });
  }

  @TsRestHandler(contract.updateCollaborator)
  updateCollaborator(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateCollaborator, async ({ body }) => {
      const updatedUser = await this.userService.update((body as { id: number }).id, {
        password: body.password,
        nickname: body.nickname,
        permissions: body.permissions,
      });
      return { status: 200, body: updatedUser };
    });
  }

  @TsRestHandler(contract.deleteCollaborator)
  deleteCollaborator(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteCollaborator, async ({ params }) => {
      await this.userService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }
}
