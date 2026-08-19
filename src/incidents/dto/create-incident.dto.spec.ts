import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateIncidentDto } from './create-incident.dto';
import { IncidentType } from '../domain/incident-type.enum';

describe('CreateIncidentDto', () => {
  it('allows an empty description for one-tap SOS creation', async () => {
    const input = Object.assign(new CreateIncidentDto(), {
      clientRequestId: '2b9572e1-dddd-47c1-a77c-65fda91db2a2',
      type: IncidentType.MEDICAL,
      description: '',
      location: { latitude: 12.9, longitude: 77.5, accuracyMeters: 8 },
    });

    const errors = await validate(input);

    expect(errors.find((error) => error.property === 'description')).toBeUndefined();
  });
});
