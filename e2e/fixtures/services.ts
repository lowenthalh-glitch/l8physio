import { AREA } from './env';
import { ServiceRef } from './api';

/**
 * Catalog of every physio service exposed in the UI (physio-config.js) plus
 * the helper services. Single source of truth for api / desktop / mobile specs.
 */
export interface PhysioService extends ServiceRef {
  key: string;        // data-service in sections/physio.html
  label: string;      // sub-nav label
  /** Unique-token field used to find a created row (L8QL-safe value). */
  markerField: string;
  readOnly?: boolean;
}

const svc = (key: string, label: string, name: string, type: string, idField: string, markerField: string, extra: Partial<PhysioService> = {}): PhysioService =>
  ({ key, label, name, type, idField, markerField, area: AREA, ...extra });

export const SERVICES = {
  htdash:       svc('htdash',       'Dashboard',          'HTDash',     'HeadThDashRow',        'rowId',      'rowId', { readOnly: true }),
  therapists:   svc('therapists',   'Therapists',         'PhyTherapt', 'PhysioTherapist',      'therapistId','lastName'),
  clients:      svc('clients',      'Clients',            'PhyClient',  'PhysioClient',         'clientId',   'lastName'),
  exercises:    svc('exercises',    'Exercises',          'PhyExercis', 'PhysioExercise',       'exerciseId', 'name'),
  protocols:    svc('protocols',    'Protocol Templates', 'PhyProto',   'PhysioProtocol',       'protocolId', 'name'),
  plans:        svc('plans',        'Treatment Plans',    'PhyPlan',    'TreatmentPlan',        'planId',     'title'),
  appointments: svc('appointments', 'Appointments',       'PhyAppt',    'Appointment',          'apptId',     'location'),
  progress:     svc('progress',     'Progress Logs',      'PhyLog',     'ProgressLog',          'logId',      'generalNotes'),
  reports:      svc('reports',      'Session Reports',    'SessRpt',    'SessionReport',        'reportId',   'notes'),
  feedback:     svc('feedback',     'Home Feedback',      'HomeFdbk',   'HomeFeedback',         'feedbackId', 'notes'),
  boostapp:     svc('boostapp',     'Boostapp Calendar',  'BstpCal',    'BoostappCalendarEvent','eventId',    'title'),
} as const;

export const WORKOUT: ServiceRef  = { name: 'PhyWorkout', area: AREA, type: 'GeneratedWorkout',   idField: 'workoutId' };
export const SWAP_LOG: ServiceRef = { name: 'ExSwapLog',  area: AREA, type: 'ExerciseSwapLog',    idField: 'swapId' };
export const OVERRIDE_LOG: ServiceRef = { name: 'OvrdLog', area: AREA, type: 'StatusOverrideLog', idField: 'overrideId' };

/** Services shown as sub-nav items, in UI order (Workout Builder is a separate view). */
export const NAV_SERVICES: PhysioService[] = Object.values(SERVICES);
/** Services a user can create/edit/delete (everything except the read-only dashboard). */
export const CRUD_SERVICES: PhysioService[] = NAV_SERVICES.filter(s => !s.readOnly);
