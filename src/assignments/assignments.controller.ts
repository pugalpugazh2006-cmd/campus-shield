import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { AssignmentsService } from './assignments.service';
import { RejectAssignmentDto } from './dto/reject-assignment.dto';
import { FirestoreDocumentIdPipe } from '../common/firestore-document-id.pipe';
import { AssignmentResponse, toAssignmentResponse } from '../common/public-api-presenters';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';

@Controller('assignments')
@Roles(UserRole.RESPONDER)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() input: ListAssignmentsQueryDto,
  ): Promise<AssignmentResponse[]> {
    return (await this.assignmentsService.listAuthorized(user, input.limit)).map(
      toAssignmentResponse,
    );
  }

  @Get(':assignmentId')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', FirestoreDocumentIdPipe) assignmentId: string,
  ): Promise<AssignmentResponse> {
    return toAssignmentResponse(await this.assignmentsService.getAuthorized(user, assignmentId));
  }

  @Post(':assignmentId/accept')
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', FirestoreDocumentIdPipe) assignmentId: string,
  ): Promise<AssignmentResponse> {
    return toAssignmentResponse(await this.assignmentsService.accept(user, assignmentId));
  }

  @Post(':assignmentId/reject')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId', FirestoreDocumentIdPipe) assignmentId: string,
    @Body() input: RejectAssignmentDto,
  ): Promise<AssignmentResponse> {
    return toAssignmentResponse(await this.assignmentsService.reject(user, assignmentId, input));
  }
}
