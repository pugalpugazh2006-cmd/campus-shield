import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuditModule } from './audit/audit.module';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { validateEnvironment } from './config/environment.validation';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RespondersModule } from './responders/responders.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { RoutingModule } from './routing/routing.module';
import { DeviceTokensModule } from './device-tokens/device-tokens.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    FirebaseModule,
    AuthModule,
    HealthModule,
    AuditModule,
    NotificationsModule,
    LocationsModule,
    UsersModule,
    AdminModule,
    RoutingModule,
    DeviceTokensModule,
    RespondersModule,
    IncidentsModule,
    AssignmentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
