import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { AdminAccountsService, ProvisionedAccount } from './admin-accounts.service';
import { ProvisionAccountDto } from './dto/provision-account.dto';
import { FirestoreDocumentIdPipe } from '../common/firestore-document-id.pipe';

@Controller('admin/accounts')
@Roles(UserRole.ADMIN)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Post()
  provision(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: ProvisionAccountDto,
  ): Promise<ProvisionedAccount> {
    return this.accounts.provision(actor, input);
  }

  @Patch(':uid/disable')
  disable(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('uid', FirestoreDocumentIdPipe) uid: string,
  ): Promise<void> {
    return this.accounts.disable(actor, uid);
  }
}
