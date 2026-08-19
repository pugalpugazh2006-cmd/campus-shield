import { Body, Controller, Post } from '@nestjs/common';
import { AllowUnprovisioned } from './allow-unprovisioned.decorator';
import { AuthService, BootstrapStudentResponse } from './auth.service';
import { CurrentFirebaseIdentity } from './current-firebase-identity.decorator';
import { BootstrapStudentDto } from './dto/bootstrap-student.dto';
import { FirebaseIdentity } from './firebase-identity.interface';
import { toUserProfileResponse, UserProfileResponse } from '../common/public-api-presenters';
import { UserRole } from './user-role.enum';

export interface BootstrapStudentApiResponse {
  profile: UserProfileResponse;
  claims: { role: UserRole.STUDENT; campusId: string };
  refreshTokenRequired: true;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('bootstrap/student')
  @AllowUnprovisioned()
  async bootstrapStudent(
    @CurrentFirebaseIdentity() identity: FirebaseIdentity,
    @Body() input: BootstrapStudentDto,
  ): Promise<BootstrapStudentApiResponse> {
    const result: BootstrapStudentResponse = await this.authService.bootstrapStudent(
      identity,
      input,
    );
    return { ...result, profile: toUserProfileResponse(result.profile) };
  }
}
