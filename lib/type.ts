export type UserRole =
  | 'super_admin'
  | 'principal'
  | 'class_teacher'
  | 'parent'
  | 'bus_driver'
  | 'accountant';

export interface UserSession {
  phone: string;
  role: UserRole;
  schoolId: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  class: string;
  section: string;
  roll_number: number;
  parent_phone: string;
  parent_name: string;
  dob: string;
  address: string;
  fees_due: number;
  fees_paid: number;
  admission_date: string;
  bus_route_id?: string;
  photo_url?: string;
  school_id: string;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  subject?: string;
  phone: string;
  email?: string;
  salary: number;
  joining_date: string;
  address?: string;
  assigned_class?: string;
  assigned_section?: string;
  school_id: string;
}

export type StaffRole =
  | 'Principal'
  | 'Vice Principal'
  | 'Class Teacher'
  | 'Subject Teacher'
  | 'Accountant'
  | 'Clerk'
  | 'Peon'
  | 'Bus Driver';

export interface Admission {
  id: string;
  student_name: string;
  dob: string;
  class_applying: string;
  parent_name: string;
  parent_phone: string;
  address: string;
  previous_school?: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_date: string;
  approved_date?: string;
  assigned_class?: string;
  assigned_section?: string;
  assigned_roll?: number;
  school_id: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  marked_by: string;
  marked_at: string;
  school_id: string;
}

export interface MarksRecord {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  subject: string;
  exam_type: 'UT1' | 'UT2' | 'Half-Yearly' | 'Annual';
  marks: number;
  max_marks: number;
  grade: string;
  academic_year: string;
  school_id: string;
}

export interface Complaint {
  id: string;
  submitted_by_phone: string;
  submitted_by_name: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_reply?: string;
  created_at: string;
  updated_at: string;
  school_id: string;
}

export interface SMSLog {
  id: string;
  recipient_phone: string;
  recipient_name: string;
  message: string;
  language: 'en' | 'hi' | 'pa' | 'kangri' | 'haryanvi';
  channel: 'sms' | 'whatsapp' | 'both';
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  cost?: number;
  school_id: string;
}

export interface Bus {
  id: string;
  bus_number: string;
  route_name: string;
  driver_phone: string;
  driver_name: string;
  capacity: number;
  students_onboard: number;
  is_active: boolean;
  current_location?: {
    latitude: number;
    longitude: number;
    updated_at: string;
  };
  route_stops: string[];
  school_id: string;
}

export interface PTMMeeting {
  id: string;
  title: string;
  class: string;
  section: string;
  date: string;
  time: string;
  venue: string;
  description?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  sms_sent: boolean;
  created_by: string;
  school_id: string;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  parent_phone: string;
  amount: number;
  amount_paid: number;
  fee_type: string;
  due_date: string;
  paid_date?: string;
  status: 'paid' | 'due' | 'overdue';
  payment_method?: 'cash' | 'upi' | 'razorpay' | 'bank_transfer';
  transaction_id?: string;
  academic_year: string;
  school_id: string;
}

export interface TransferCertificate {
  id: string;
  tc_number: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  dob: string;
  admission_date: string;
  leaving_date: string;
  reason: string;
  conduct: string;
  status: 'issued' | 'collected';
  issued_date: string;
  collected_date?: string;
  school_id: string;
}

export interface DropoutRecord {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  dropout_date: string;
  reason:
    | 'financial'
    | 'migration'
    | 'marriage'
    | 'illness'
    | 'distance'
    | 'other';
  remarks?: string;
  parent_phone: string;
  follow_up_done: boolean;
  school_id: string;
}

export interface TimetableGrid {
  id: string;
  class: string;
  section: string;
  academic_year: string;
  grid: TimetableCell[][];
  school_id: string;
}

export interface TimetableCell {
  day: string;
  period: number;
  subject: string;
  teacher_name: string;
  teacher_id: string;
}

export interface RankingRecord {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  subject: string;
  exam_type: string;
  marks: number;
  max_marks: number;
  percentage: number;
  rank: number;
  grade: string;
  school_id: string;
}

export interface InspectionItem {
  id: string;
  title: string;
  is_ready: boolean;
  last_updated: string;
  school_id: string;
}

export interface PerformanceRating {
  id: string;
  student_id: string;
  student_name: string;
  class: string;
  section: string;
  subject: string;
  rating: number;
  remarks: string;
  trend: 'improving' | 'declining' | 'stable';
  academic_year: string;
  school_id: string;
}

export interface School {
  id: string;
  name: string;
  udise_code: string;
  principal: string;
  phone: string;
  address: string;
  academic_year: string;
  affiliation_number?: string;
  board?: string;
}

export interface UserDocument {
  phone: string;
  role: UserRole;
  name: string;
  school_id: string;
  fcm_token?: string;
  language_preference?: 'en' | 'hi';
  notification_sms?: boolean;
  notification_whatsapp?: boolean;
  notification_push?: boolean;
  children?: string[];
  bus_id?: string;
}