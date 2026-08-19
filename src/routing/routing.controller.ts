import { Body, Controller, Param, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { IncidentsService } from '../incidents/incidents.service';
import { RouteRequestDto } from './dto/route-request.dto';
import { RouteResponse } from './routing-provider-response';
import { RoutingService } from './routing.service';
import { FirestoreDocumentIdPipe } from '../common/firestore-document-id.pipe';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('routes')
@Roles(UserRole.RESPONDER)
export class RoutingController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly routing: RoutingService,
  ) {}

  @Post('incidents/:incidentId')
  async routeForIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: RouteRequestDto,
  ): Promise<RouteResponse> {
    const incident = await this.incidents.getAuthorized(user, incidentId);
    return this.routing.getRoute(incident, input);
  }
}
