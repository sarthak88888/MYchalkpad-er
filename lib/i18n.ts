import { I18n } from 'i18n-js';
import { getLanguagePreference, setLanguagePreference } from './storage';

const translations = {
  en: {
    // App
    app_name: 'MyChalkPad',
    app_subtitle: 'School ERP System',

    // Auth
    login: 'Login',
    phone_number: 'Phone Number',
    enter_phone: 'Enter 10-digit phone number',
    send_otp: 'Send OTP',
    enter_otp: 'Enter OTP',
    verify_login: 'Verify & Login',
    otp_sent: 'OTP sent to +91',
    invalid_phone: 'Please enter a valid 10-digit phone number',
    invalid_otp: 'Please enter the 6-digit OTP',
    login_failed: 'Login failed. Please try again.',
    enable_fingerprint: 'Enable Fingerprint Login?',
    fingerprint_prompt: 'Use fingerprint for quick login',
    yes: 'Yes',
    no: 'No',
    verify: 'Verify',

    // Navigation
    dashboard: 'Dashboard',
    students: 'Students',
    reports: 'Reports',
    settings: 'Settings',
    attendance: 'Attendance',
    timetable: 'Timetable',
    profile: 'Profile',
    fees: 'Fees',
    complaints: 'Complaints',
    my_children: 'My Children',
    bus_gps: 'Bus GPS',

    // Dashboard
    total_students: 'Total Students',
    total_staff: 'Total Staff',
    today_attendance: "Today's Attendance",
    sms_sent: 'SMS Sent',

    // Students
    add_student: 'Add Student',
    student_name: 'Student Name',
    class: 'Class',
    section: 'Section',
    roll_number: 'Roll Number',
    parent_phone: 'Parent Phone',
    search_students: 'Search students...',
    no_students: 'No students found',

    // Attendance
    mark_attendance: 'Mark Attendance',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    submit_attendance: 'Submit & Notify Parents',
    attendance_submitted: 'Attendance submitted successfully',
    already_submitted: 'Attendance already submitted for today',

    // Fees
    fee_management: 'Fee Management',
    total_collected: 'Total Collected',
    total_pending: 'Total Pending',
    mark_paid: 'Mark as Paid (Cash)',
    pay_online: 'Pay Online',
    fee_paid: 'Fee marked as paid',
    due: 'Due',
    paid: 'Paid',
    overdue: 'Overdue',
    amount: 'Amount',
    due_date: 'Due Date',

    // Marks
    marks_entry: 'Marks Entry',
    subject: 'Subject',
    exam_type: 'Exam Type',
    max_marks: 'Max Marks',
    obtained_marks: 'Obtained Marks',
    grade: 'Grade',
    save_marks: 'Save Marks',

    // Complaints
    new_complaint: 'New Complaint',
    complaint_subject: 'Subject',
    complaint_description: 'Description',
    submit_complaint: 'Submit Complaint',
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',

    // SMS
    send_sms: 'Send SMS',
    send_whatsapp: 'Send WhatsApp',
    message: 'Message',
    recipients: 'Recipients',
    language: 'Language',
    send: 'Send',
    sms_sent_success: 'Messages sent successfully',

    // Bus
    start_route: 'Start Route',
    stop_route: 'Stop Route',
    students_onboard: 'Students Onboard',
    bus_number: 'Bus Number',
    route_name: 'Route Name',
    location_updated: 'Location updated',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    logout: 'Logout',
    logout_confirm: 'Are you sure you want to logout?',
    network_error: 'Network error. Please check your connection.',
    unknown_error: 'Something went wrong. Please try again.',
    required_field: 'This field is required',
    saved_successfully: 'Saved successfully',
    deleted_successfully: 'Deleted successfully',
    no_data: 'No data available',
  },
  hi: {
    // App
    app_name: 'माईचॉकपैड',
    app_subtitle: 'स्कूल ERP सिस्टम',

    // Auth
    login: 'लॉगिन',
    phone_number: 'फोन नंबर',
    enter_phone: '10 अंकों का फोन नंबर दर्ज करें',
    send_otp: 'OTP भेजें',
    enter_otp: 'OTP दर्ज करें',
    verify_login: 'सत्यापित करें और लॉगिन करें',
    otp_sent: 'OTP भेजा गया +91',
    invalid_phone: 'कृपया वैध 10 अंकों का फोन नंबर दर्ज करें',
    invalid_otp: 'कृपया 6 अंकों का OTP दर्ज करें',
    login_failed: 'लॉगिन विफल। कृपया पुनः प्रयास करें।',
    enable_fingerprint: 'फिंगरप्रिंट लॉगिन सक्षम करें?',
    fingerprint_prompt: 'त्वरित लॉगिन के लिए फिंगरप्रिंट उपयोग करें',
    yes: 'हाँ',
    no: 'नहीं',
    verify: 'सत्यापित करें',

    // Navigation
    dashboard: 'डैशबोर्ड',
    students: 'छात्र',
    reports: 'रिपोर्ट',
    settings: 'सेटिंग्स',
    attendance: 'उपस्थिति',
    timetable: 'समय सारिणी',
    profile: 'प्रोफ़ाइल',
    fees: 'शुल्क',
    complaints: 'शिकायतें',
    my_children: 'मेरे बच्चे',
    bus_gps: 'बस GPS',

    // Dashboard
    total_students: 'कुल छात्र',
    total_staff: 'कुल स्टाफ',
    today_attendance: 'आज की उपस्थिति',
    sms_sent: 'SMS भेजे गए',

    // Students
    add_student: 'छात्र जोड़ें',
    student_name: 'छात्र का नाम',
    class: 'कक्षा',
    section: 'अनुभाग',
    roll_number: 'रोल नंबर',
    parent_phone: 'अभिभावक फोन',
    search_students: 'छात्र खोजें...',
    no_students: 'कोई छात्र नहीं मिला',

    // Attendance
    mark_attendance: 'उपस्थिति दर्ज करें',
    present: 'उपस्थित',
    absent: 'अनुपस्थित',
    late: 'देर से',
    submit_attendance: 'जमा करें और माता-पिता को सूचित करें',
    attendance_submitted: 'उपस्थिति सफलतापूर्वक जमा की गई',
    already_submitted: 'आज की उपस्थिति पहले ही जमा हो चुकी है',

    // Fees
    fee_management: 'शुल्क प्रबंधन',
    total_collected: 'कुल संग्रहित',
    total_pending: 'कुल बकाया',
    mark_paid: 'नकद भुगतान चिह्नित करें',
    pay_online: 'ऑनलाइन भुगतान करें',
    fee_paid: 'शुल्क भुगतान के रूप में चिह्नित',
    due: 'बकाया',
    paid: 'भुगतान किया',
    overdue: 'अतिदेय',
    amount: 'राशि',
    due_date: 'देय तिथि',

    // Marks
    marks_entry: 'अंक प्रविष्टि',
    subject: 'विषय',
    exam_type: 'परीक्षा प्रकार',
    max_marks: 'अधिकतम अंक',
    obtained_marks: 'प्राप्त अंक',
    grade: 'ग्रेड',
    save_marks: 'अंक सहेजें',

    // Complaints
    new_complaint: 'नई शिकायत',
    complaint_subject: 'विषय',
    complaint_description: 'विवरण',
    submit_complaint: 'शिकायत जमा करें',
    open: 'खुली',
    in_progress: 'प्रक्रियाधीन',
    resolved: 'हल की गई',

    // SMS
    send_sms: 'SMS भेजें',
    send_whatsapp: 'WhatsApp भेजें',
    message: 'संदेश',
    recipients: 'प्राप्तकर्ता',
    language: 'भाषा',
    send: 'भेजें',
    sms_sent_success: 'संदेश सफलतापूर्वक भेजे गए',

    // Bus
    start_route: 'रूट शुरू करें',
    stop_route: 'रूट बंद करें',
    students_onboard: 'छात्र सवार',
    bus_number: 'बस नंबर',
    route_name: 'रूट का नाम',
    location_updated: 'स्थान अपडेट किया गया',

    // Common
    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    add: 'जोड़ें',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    all: 'सभी',
    loading: 'लोड हो रहा है...',
    error: 'त्रुटि',
    success: 'सफलता',
    confirm: 'पुष्टि करें',
    logout: 'लॉगआउट',
    logout_confirm: 'क्या आप लॉगआउट करना चाहते हैं?',
    network_error: 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
    unknown_error: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
    required_field: 'यह फ़ील्ड आवश्यक है',
    saved_successfully: 'सफलतापूर्वक सहेजा गया',
    deleted_successfully: 'सफलतापूर्वक हटाया गया',
    no_data: 'कोई डेटा उपलब्ध नहीं',
  },
};

export const i18n = new I18n(translations);
i18n.locale = 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export async function loadLanguage(): Promise<void> {
  const lang = await getLanguagePreference();
  i18n.locale = lang;
}

export function setLanguage(lang: 'en' | 'hi'): void {
  i18n.locale = lang;
  setLanguagePreference(lang);
}

export function t(key: string): string {
  return i18n.t(key);
}