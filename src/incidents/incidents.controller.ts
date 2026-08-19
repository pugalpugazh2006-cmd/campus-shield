import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentNoteDto } from './dto/incident-note.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentsService } from './incidents.service';
import { ReassignIncidentDto } from './dto/reassign-incident.dto';
import { DispatchService } from '../dispatch/dispatch.service';
import { FirestoreDocumentIdPipe } from '../common/firestore-document-id.pipe';
import { IncidentResponse, toIncidentResponse } from '../common/public-api-presenters';

@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly dispatchService: DispatchService,
  ) {}

  @Post()
  @Roles(UserRole.STUDENT)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateIncidentDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(await this.incidentsService.create(user, input));
  }

  @Get(':incidentId')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(await this.incidentsService.getAuthorized(user, incidentId));
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() input: ListIncidentsQueryDto,
  ): Promise<IncidentResponse[]> {
    return (await this.incidentsService.listAuthorized(user, input)).map(toIncidentResponse);
  }

  @Post(':incidentId/start-route')
  @Roles(UserRole.RESPONDER)
  async startRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: IncidentNoteDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(await this.incidentsService.startRoute(user, incidentId, input.note));
  }

  @Post(':incidentId/arrive')
  @Roles(UserRole.RESPONDER)
  async arrive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: IncidentNoteDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(await this.incidentsService.arrive(user, incidentId, input.note));
  }

  @Post(':incidentId/resolve')
  @Roles(UserRole.RESPONDER)
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: ResolveIncidentDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(await this.incidentsService.resolve(user, incidentId, input.summary));
  }

  @Post(':incidentId/cancel')
  @Roles(UserRole.STUDENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: IncidentNoteDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(
      await this.incidentsService.cancelByStudent(user, incidentId, input.note),
    );
  }

  @Post(':incidentId/false-alarm')
  @Roles(UserRole.STUDENT)
  async falseAlarm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: IncidentNoteDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(
      await this.incidentsService.falseAlarmByStudent(user, incidentId, input.note),
    );
  }

  @Post(':incidentId/escalate')
  @Roles(UserRole.ADMIN)
  async escalate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: IncidentNoteDto,
  ): Promise<IncidentResponse> {
    return toIncidentResponse(
      await this.incidentsService.escalateByAdmin(user, incidentId, input.note),
    );
  }

  @Post(':incidentId/reassign')
  @Roles(UserRole.ADMIN)
  async reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId', FirestoreDocumentIdPipe) incidentId: string,
    @Body() input: ReassignIncidentDto,
  ): Promise<{ assignmentId: string }> {
    const assignmentId = await this.dispatchService.reassign(user, incidentId, input.responderId);
    return { assignmentId };
  }
}
