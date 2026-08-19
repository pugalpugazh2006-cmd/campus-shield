import { IsIn } from 'class-validator';
import { ResponderStatus } from '../domain/responder-status.enum';

export class SetResponderAvailabilityDto {
  @IsIn([ResponderStatus.OFF_DUTY, ResponderStatus.AVAILABLE])
  status!: ResponderStatus.OFF_DUTY | ResponderStatus.AVAILABLE;
}
