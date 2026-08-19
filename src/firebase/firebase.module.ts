import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { AppConfig } from '../config/app-config';
import {
  FIREBASE_APP,
  FIREBASE_AUTH,
  FIREBASE_MESSAGING,
  FIRESTORE,
  REALTIME_DATABASE,
} from './firebase.constants';

const firebaseAppProvider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) => {
    const existing = getApps()[0];
    if (existing) return existing;

    return initializeApp({
      credential: cert({
        projectId: config.get('FIREBASE_PROJECT_ID', { infer: true }),
        clientEmail: config.get('FIREBASE_CLIENT_EMAIL', { infer: true }),
        privateKey: config.get('FIREBASE_PRIVATE_KEY', { infer: true }),
      }),
      databaseURL: config.get('FIREBASE_DATABASE_URL', { infer: true }),
    });
  },
};

@Global()
@Module({
  providers: [
    firebaseAppProvider,
    { provide: FIREBASE_AUTH, inject: [FIREBASE_APP], useFactory: getAuth },
    { provide: FIRESTORE, inject: [FIREBASE_APP], useFactory: getFirestore },
    { provide: REALTIME_DATABASE, inject: [FIREBASE_APP], useFactory: getDatabase },
    { provide: FIREBASE_MESSAGING, inject: [FIREBASE_APP], useFactory: getMessaging },
  ],
  exports: [FIREBASE_APP, FIREBASE_AUTH, FIRESTORE, REALTIME_DATABASE, FIREBASE_MESSAGING],
})
export class FirebaseModule {}
