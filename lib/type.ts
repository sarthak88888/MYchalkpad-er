// lib/types.ts — Shared TypeScript types for MyChalkPad ERP

export type UserRole = 'admin' | 'teacher' | 'accountant' | 'parent' | 'student';

export interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  principalName: string;
  board: string;
  udiseCode?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  subscriptionPlan?: 'free' | 'basic' | 'premium';
  subscriptionExpiry?: Date;
  razorpayKeyId?: string;
  smsProvider?: 'fast2sms' | 'msg91' | 'none';
  smsApiKey?: string;
  smsSenderId?: string;
  language?: string;
  timezone?: string;
  academicYear?: string;
  classes?: string[];
  sections?: string[];
  subjects?: string[];
}

export interface StaffMember {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  employeeId?: string;
  designation?: string;
  department?: string;
  qualification?: string;
  joiningDate?: string;
  salary?: number;
  address?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  schoolId: string;
  name: string;
  rollNumber: string;
  class: string;
  section: string;
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  photoUrl?: string;
  admissionDate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  class: string;
  section: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'holiday';
  markedBy?: string;
  createdAt: Date;
}

export interface FeeRecord {
  id: string;
  schoolId: string;
  student_name: string;
  student_id: string;
  class: string;
  section: string;
  fee_type: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  paid_date?: string;
  status: 'paid' | 'pending' | 'due' | 'overdue';
  payment_method?: 'cash' | 'online' | 'cheque' | 'dd' | 'razorpay';
  transaction_id?: string;
  parent_phone?: string;
  academic_year?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface MarksRecord {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  class: string;
  section: string;
  subject: string;
  examType: string;
  maxMarks: number;
  obtainedMarks: number;
  grade?: string;
  remarks?: string;
  enteredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Complaint {
  id: string;
  schoolId: string;
  studentId?: string;
  parentId?: string;
  submittedBy: string;
  submitterRole: UserRole;
  subject: string;
  description: string;
  category?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdmissionRecord {
  id: string;
  schoolId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  class: string;
  section?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  previousSchool?: string;
  status: 'applied' | 'under_review' | 'approved' | 'rejected' | 'enrolled';
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timetable {
  id: string;
  schoolId: string;
  class: string;
  section: string;
  day: string;
  period: number;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  startTime: string;
  endTime: string;
  room?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PTMMeeting {
  id: string;
  schoolId: string;
  class: string;
  section?: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime?: string;
  venue?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransferCertificate {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  class: string;
  section?: string;
  tcNumber?: string;
  issueDate: string;
  reason?: string;
  remarks?: string;
  status: 'issued' | 'pending';
  issuedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DropoutRecord {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  class: string;
  section?: string;
  dropoutDate: string;
  reason: string;
  remarks?: string;
  followUpStatus?: 'pending' | 'contacted' | 'resolved';
  reportedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionRecord {
  id: string;
  schoolId: string;
  inspectorName: string;
  inspectorDesignation?: string;
  inspectionDate: string;
  inspectionType?: string;
  findings?: string;
  recommendations?: string;
  rating?: number;
  followUpDate?: string;
  status: 'scheduled' | 'completed' | 'pending_report';
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceRating {
  id: string;
  schoolId: string;
  staffId: string;
  staffName: string;
  ratedBy: string;
  ratingPeriod: string;
  overallRating: number;
  teachingQuality?: number;
  punctuality?: number;
  studentEngagement?: number;
  administration?: number;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SmsLog {
  id: string;
  schoolId: string;
  recipient: string;
  recipientName?: string;
  message: string;
  messageType?: string;
  status: 'sent' | 'failed' | 'pending';
  provider?: string;
  requestId?: string;
  sentAt: Date;
  createdAt: Date;
}

export interface RankingRecord {
  id: string;
  schoolId: string;
  class: string;
  section?: string;
  examType: string;
  studentId: string;
  studentName: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  rank: number;
  grade?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSResult {
  success: boolean;
  message: string;
  request_id?: string;
  successCount?: number;
  failCount?: number;
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
}