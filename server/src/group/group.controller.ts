import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { GroupService, GroupPermissionsInput } from './group.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async createGroup(
    @CurrentUser() user: any,
    @Body()
    body: {
      name: string;
      memberIds: string[];
      description?: string;
      avatar?: string;
      permissions?: GroupPermissionsInput;
    },
  ) {
    return this.groupService.createGroup(
      user.id,
      body.name,
      body.memberIds,
      body.description,
      body.avatar,
      body.permissions,
    );
  }

  @Get(':id')
  async getGroup(@CurrentUser() user: any, @Param('id') groupId: string) {
    return this.groupService.getGroup(groupId, user.id);
  }

  @Put(':id')
  async updateGroup(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Body() body: { name?: string; description?: string; avatar?: string },
  ) {
    return this.groupService.updateGroup(groupId, user.id, body);
  }

  @Patch(':id/permissions')
  async updatePermissions(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Body() body: GroupPermissionsInput,
  ) {
    return this.groupService.updatePermissions(groupId, user.id, body);
  }

  @Delete(':id')
  async deleteGroup(@CurrentUser() user: any, @Param('id') groupId: string) {
    return this.groupService.deleteGroup(groupId, user.id);
  }

  @Post(':id/members')
  async addMembers(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Body() body: { memberIds: string[] },
  ) {
    return this.groupService.addMembers(groupId, user.id, body.memberIds);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupService.removeMember(groupId, user.id, memberId);
  }

  @Post(':id/leave')
  async leaveGroup(@CurrentUser() user: any, @Param('id') groupId: string) {
    return this.groupService.leaveGroup(groupId, user.id);
  }

  @Post(':id/admins')
  async makeAdmin(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Body() body: { memberId: string },
  ) {
    return this.groupService.makeAdmin(groupId, user.id, body.memberId);
  }

  @Delete(':id/admins/:memberId')
  async removeAdmin(
    @CurrentUser() user: any,
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupService.removeAdmin(groupId, user.id, memberId);
  }
}
