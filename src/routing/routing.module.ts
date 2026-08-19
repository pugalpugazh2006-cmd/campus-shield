import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  imports: [IncidentsModule],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
