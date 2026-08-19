import { Inject, Injectable } from '@nestjs/common';
import { Messaging } from 'firebase-admin/messaging';
import { FIREBASE_MESSAGING } from '../firebase/firebase.constants';

export type NotificationPayloadType =
  | 'DISPATCH_OFFER'
  | 'OFFER_EXPIRED'
  | 'INCIDENT_ASSIGNED'
  | 'RESPONDER_EN_ROUTE'
  | 'RESPONDER_ARRIVED'
  | 'INCIDENT_RESOLVED'
  | 'INCIDENT_CANCELLED'
  | 'INCIDENT_ESCALATED';

export interface IncidentNotification {
  token: string;
  incidentId: string;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(FIREBASE_MESSAGING) private readonly messaging: Messaging) {}

  sendIncidentNotification(notification: IncidentNotification): Promise<string> {
    return this.messaging.send({
      token: notification.token,
      notification: { title: notification.title, body: notification.body },
      data: { type: 'INCIDENT_UPDATE', incidentId: notification.incidentId },
      android: { priority: 'high' },
    });
  }

  async sendDispatchOffer(
    token: string,
    assignmentId: string,
    incidentId: string,
    incidentType: string,
  ): Promise<string> {
    return this.messaging.send({
      token,
      notification: {
        title: '🚨 Emergency Dispatch',
        body: `${incidentType} incident — accept or decline within 45 seconds`,
      },
      data: { type: 'DISPATCH_OFFER', assignmentId, incidentId },
      android: {
        priority: 'high',
        notification: { channelId: 'dispatch_alerts', sound: 'default', priority: 'max' },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  }

  async sendIncidentUpdate(
    token: string,
    incidentId: string,
    type: NotificationPayloadType,
    title: string,
    body: string,
  ): Promise<string> {
    return this.messaging.send({
      token,
      notification: { title, body },
      data: { type, incidentId },
      android: { priority: 'high' },
    });
  }

  async sendBatch(notifications: IncidentNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    const messages = notifications.map((n) => ({
      token: n.token,
      notification: { title: n.title, body: n.body },
      data: { type: 'INCIDENT_UPDATE', incidentId: n.incidentId },
      android: { priority: 'high' as const },
    }));
    
    try {
      const response = await this.messaging.sendEach(messages);
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          console.error(`Failed to send notification to ${messages[idx].token}:`, res.error);
        }
      });
    } catch (error) {
      console.error('Failed to send batch notifications:', error);
    }
  }
}
