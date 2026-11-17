import { Schema, model } from 'mongoose';
import { ROLES } from './auth/permissions.js';

const userSchema = new Schema({
  identifier: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ROLES },
  studentId: { type: String, index: true },
  forcePasswordChange: { type: Boolean, default: true },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  passwordChangedAt: { type: Date }
}, { timestamps: true });
export const User = model('User', userSchema);

const refreshTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  familyId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  replacedByHash: { type: String }
}, { timestamps: true });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = model('RefreshToken', refreshTokenSchema);

const auditLogSchema = new Schema({
  action: { type: String, required: true, index: true },
  actorId: String,
  actorRole: String,
  subject: { type: String, index: true },
  requestId: String,
  ip: String,
  metadata: { type: Schema.Types.Mixed },
  at: { type: Date, required: true, index: true }
});
export const AuditLog = model('AuditLog', auditLogSchema);

const studentSchema = new Schema({
  studentId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  programme: { type: String, required: true, index: true },
  yearGroup: { type: Number, required: true, index: true },
  track: { type: String, default: 'standard' }
}, { timestamps: true });
studentSchema.index({ programme: 1, yearGroup: 1 });
export const Student = model('Student', studentSchema);

const attemptSchema = new Schema({
  credits: { type: Number, required: true, min: 0 },
  grade: String,
  status: { type: String, enum: ['COMPLETED', 'ENROLLED', 'INCOMPLETE'], required: true },
  semester: String,
  attemptedAt: Date
}, { _id: true });
const enrollmentSchema = new Schema({
  studentId: { type: String, required: true, index: true },
  courseCode: { type: String, required: true },
  attempts: [attemptSchema]
}, { timestamps: true });
enrollmentSchema.index({ studentId: 1, courseCode: 1 }, { unique: true });
export const Enrollment = model('Enrollment', enrollmentSchema);

const requirementSchema = new Schema({
  programme: { type: String, required: true, index: true },
  version: { type: String, required: true },
  effectiveFrom: Date,
  track: { type: String, required: true },
  creditsRequired: { type: Number, required: true },
  requirements: [{ courseCode: String, name: String, category: String, credits: Number, minPassingGrade: String }]
}, { timestamps: true });
requirementSchema.index({ programme: 1, version: 1, track: 1 }, { unique: true });
export const ProgrammeRequirement = model('ProgrammeRequirement', requirementSchema);
