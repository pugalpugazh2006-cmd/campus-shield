import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UsersService } from './users.service';
import { toUserProfileResponse, UserProfileResponse } from '../common/public-api-presenters';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponse> {
    return toUserProfileResponse(await this.usersService.getCurrentUser(user));
  }

  @Patch('me')
  updateCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateUserProfileDto,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateCurrentUser(user, input).then(toUserProfileResponse);
  }
}
