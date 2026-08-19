import { Controller, Get, Inject } from '@nestjs/common';
import { App } from 'firebase-admin/app';
import { Public } from '../auth/public.decorator';
import { FIREBASE_APP } from '../firebase/firebase.constants';

interface HealthResponse {
  status: 'ok';
  service: 'campusshield-api';
  firebaseProjectId?: string;
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(FIREBASE_APP) private readonly firebaseApp: App) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'campusshield-api',
      firebaseProjectId: this.firebaseApp.options.projectId,
      timestamp: new Date().toISOString(),
    };
  }
}
