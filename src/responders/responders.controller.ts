import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { SetResponderAvailabilityDto } from './dto/set-responder-availability.dto';
import { RespondersService } from './responders.service';
import {
  ResponderProfileResponse,
  toResponderProfileResponse,
} from '../common/public-api-presenters';

@Controller('responders')
export class RespondersController {
  constructor(private readonly respondersService: RespondersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ResponderProfileResponse[]> {
    return (await this.respondersService.listForCampus(user.campusId)).map(
      toResponderProfileResponse,
    );
  }

  @Get('me')
  @Roles(UserRole.RESPONDER)
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<ResponderProfileResponse> {
    return toResponderProfileResponse(await this.respondersService.getProfile(user.uid));
  }

  @Patch('me/availability')
  @Roles(UserRole.RESPONDER)
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SetResponderAvailabilityDto,
  ): Promise<ResponderProfileResponse> {
    return this.respondersService.setOwnAvailability(user, input).then(toResponderProfileResponse);
  }
}
