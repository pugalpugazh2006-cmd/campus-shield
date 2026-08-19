import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchWorker } from './dispatch.worker';

@Module({
  providers: [DispatchService, DispatchWorker],
  exports: [DispatchService, DispatchWorker],
})
export class DispatchModule {}
