import { Body, Controller, Delete, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { DeviceTokensService } from './device-tokens.service';
import { DeviceTokenDto } from './dto/device-token.dto';
import { RevokeDeviceTokenDto } from './dto/revoke-device-token.dto';

@Controller('device-tokens')
export class DeviceTokensController {
  constructor(private readonly deviceTokens: DeviceTokensService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: DeviceTokenDto,
  ): Promise<{ registered: true }> {
    return this.deviceTokens.register(user, input);
  }

  @Delete()
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RevokeDeviceTokenDto,
  ): Promise<void> {
    return this.deviceTokens.revoke(user, input.token);
  }
}
