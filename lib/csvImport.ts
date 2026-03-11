// lib/csvImport.ts
// Bulk CSV Import Utility for MyChalkPad ERP
// Handles: Students, Parents, Staff/Teachers, Admins, Accountants, Drivers

import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { sendBulkSMS } from './fast2sms';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ImportUserRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'admin'
  | 'accountant'
  | 'driver';

export interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; name: string; reason: string }[];
}

// ─── CSV COLUMN DEFINITIONS ───────────────────────────────────────────────────
// These are the exact headers the school must use in their CSV file

export const CSV_TEMPLATES: Record<ImportUserRole, string[]> = {
  student: [
    'name',           // Full student name
    'class',          // e.g. "5"
    'section',        // e.g. "A"
    'roll_number',    // e.g. "12"
    'parent_phone',   // 10-digit — this becomes the parent's login
    'address',        // Optional
    'dob',            // DD/MM/YYYY
    'gender',         // Male / Female
    'admission_date', // DD/MM/YYYY
  ],
  teacher: [
    'name',
    'phone',           // 10-digit — their login number
    'subject',
    'class_assigned',
    'section_assigned',
    'joining_date',    // DD/MM/YYYY
  ],
  parent: [
    'name',
    'phone',
    'student_name',
    'student_class',
    'student_section',
  ],
  admin: [
    'name',
    'phone',
    'designation',     // e.g. "Principal"
  ],
  accountant: [
    'name',
    'phone',
    'joining_date',
  ],
  driver: [
    'name',
    'phone',
    'route_name',
    'vehicle_number',
  ],
};

// ─── CSV PARSER ───────────────────────────────────────────────────────────────

export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText
    .trim()
    .split('\n')
    .filter(l => l.trim() !== '');

  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row.');
  }

  const headers = lines[0]
    .split(',')
    .map(h =>
      h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    );

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// ─── VALIDATORS ───────────────────────────────────────────────────────────────

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''));
}

function validateRow(
  row: Record<string, string>,
  role: ImportUserRole
): string | null {
  if (!row.name || row.name.trim() === '') {
    return 'Missing required field: "name"';
  }

  const phoneField = role === 'student' ? 'parent_phone' : 'phone';
  const phone = row[phoneField]?.replace(/\s+/g, '');

  if (!phone || phone === '') {
    return `Missing required field: "${phoneField}"`;
  }

  if (!isValidPhone(phone)) {
    return `Invalid phone number "${phone}" — must be 10 digits starting with 6-9`;
  }

  return null;
}

// ─── FIRESTORE BATCH WRITER ───────────────────────────────────────────────────

const BATCH_SIZE = 450; // Firestore limit is 500, keeping buffer

async function writeBatchToFirestore(
  schoolId: string,
  role: ImportUserRole,
  records: Record<string, string>[]
): Promise<{
  successCount: number;
  errors: { row: number; name: string; reason: string }[];
}> {
  const errors: { row: number; name: string; reason: string }[] = [];
  let successCount = 0;

  // Split into chunks of 450
  const chunks: Record<string, string>[][] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    chunks.push(records.slice(i, i + BATCH_SIZE));
  }

  let rowOffset = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (let i = 0; i < chunk.length; i++) {
      const row = chunk[i];
      const rowIndex = rowOffset + i + 2; // +2 for header row + 1-based index

      try {
        const rawPhone = role === 'student' ? row.parent_phone : row.phone;
        const cleanPhone = rawPhone?.replace(/\s+/g, '');

        if (role === 'student') {
          // ── Add student to schools/{schoolId}/students/ ──
          const studentRef = doc(collection(db, 'schools', schoolId, 'students'));
          batch.set(studentRef, {
            name: row.name,
            class: row.class || '',
            section: row.section || '',
            roll_number: row.roll_number || '',
            parent_phone: cleanPhone,
            address: row.address || '',
            dob: row.dob || '',
            gender: row.gender || '',
            admission_date: row.admission_date || '',
            created_at: serverTimestamp(),
            source: 'csv_import',
          });

          // ── Create parent login in users/{phone} ──
          if (cleanPhone) {
            const parentRef = doc(db, 'users', cleanPhone);
            batch.set(
              parentRef,
              {
                role: 'parent',
                school_id: schoolId,
                name: `${row.name} (Parent)`,
                phone: cleanPhone,
                student_name: row.name,
                student_class: row.class || '',
                student_section: row.section || '',
                created_at: serverTimestamp(),
                source: 'csv_import',
              },
              { merge: true } // merge so a parent with 2 kids isn't overwritten
            );
          }
        } else {
          // ── Add staff/teacher/admin/accountant/driver ──
          const staffRef = doc(collection(db, 'schools', schoolId, 'staff'));
          batch.set(staffRef, {
            name: row.name,
            role: role,
            phone: cleanPhone,
            subject: row.subject || '',
            class_assigned: row.class_assigned || '',
            section_assigned: row.section_assigned || '',
            joining_date: row.joining_date || '',
            designation: row.designation || '',
            route_name: row.route_name || '',
            vehicle_number: row.vehicle_number || '',
            created_at: serverTimestamp(),
            source: 'csv_import',
          });

          // ── Create user login in users/{phone} ──
          if (cleanPhone) {
            const userRef = doc(db, 'users', cleanPhone);
            batch.set(
              userRef,
              {
                role: role,
                school_id: schoolId,
                name: row.name,
                phone: cleanPhone,
                created_at: serverTimestamp(),
                source: 'csv_import',
              },
              { merge: true }
            );
          }
        }

        successCount++;
      } catch (err: any) {
        errors.push({
          row: rowIndex,
          name: row.name || `Row ${rowIndex}`,
          reason: err?.message || 'Unknown Firestore error',
        });
      }
    }

    await batch.commit();
    rowOffset += chunk.length;
  }

  return { successCount, errors };
}

// ─── SMS NOTIFIER ─────────────────────────────────────────────────────────────

async function notifyUsersViaSMS(
  records: Record<string, string>[],
  role: ImportUserRole,
  schoolName: string
): Promise<void> {
  try {
    const phones = records
      .map(r => (role === 'student' ? r.parent_phone : r.phone))
      .filter(p => p && isValidPhone(p.replace(/\s+/g, '')))
      .map(p => p.replace(/\s+/g, ''));

    if (phones.length === 0) return;

    const message =
      role === 'student'
        ? `Dear Parent, your child is registered on MyChalkPad for ${schoolName}. Login with your mobile number to view attendance, marks & pay fees. App: mychalkpad.com`
        : `Dear ${role.charAt(0).toUpperCase() + role.slice(1)}, you are registered on MyChalkPad for ${schoolName}. Login with your mobile number. App: mychalkpad.com`;

    // Fast2SMS sendBulkSMS accepts array of phone strings + message
    await sendBulkSMS(phones, message, 'en');
  } catch (err) {
    // SMS failure must NOT block the import
    console.error('[csvImport] SMS notification failed (import was still successful):', err);
  }
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * importFromCSV — Call this from your screen
 *
 * @param csvText    Raw CSV string (read from the file picker)
 * @param role       Which type of users are in this CSV
 * @param schoolId   Firestore school document ID
 * @param schoolName Human-readable school name (used in SMS)
 * @returns          ImportResult with success count and any errors
 */
export async function importFromCSV(
  csvText: string,
  role: ImportUserRole,
  schoolId: string,
  schoolName: string
): Promise<ImportResult> {
  // Step 1: Parse CSV text into rows
  const rows = parseCSV(csvText);

  // Step 2: Validate every row
  const validRows: Record<string, string>[] = [];
  const validationErrors: { row: number; name: string; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const error = validateRow(row, role);
    if (error) {
      validationErrors.push({
        row: idx + 2,
        name: row.name || `Row ${idx + 2}`,
        reason: error,
      });
    } else {
      validRows.push(row);
    }
  });

  if (validRows.length === 0) {
    return {
      success: 0,
      failed: validationErrors.length,
      errors: validationErrors,
    };
  }

  // Step 3: Write to Firestore in batches
  const { successCount, errors: writeErrors } = await writeBatchToFirestore(
    schoolId,
    role,
    validRows
  );

  // Step 4: Send SMS to all successfully registered users
  if (successCount > 0) {
    await notifyUsersViaSMS(validRows, role, schoolName);
  }

  return {
    success: successCount,
    failed: validationErrors.length + writeErrors.length,
    errors: [...validationErrors, ...writeErrors],
  };
}

// ─── TEMPLATE GENERATOR ───────────────────────────────────────────────────────

/**
 * generateCSVTemplate — Returns a sample CSV string for the given role
 * Use this so admin can download a blank template from the app
 */
export function generateCSVTemplate(role: ImportUserRole): string {
  const headers = CSV_TEMPLATES[role];

  const examples: Record<ImportUserRole, string> = {
    student:    'Rahul Sharma,5,A,12,9876543210,123 Main Street,15/08/2014,Male,01/04/2024',
    teacher:    'Priya Singh,9876543211,Mathematics,6,B,01/06/2020',
    parent:     'Suresh Kumar,9876543212,Rahul Sharma,5,A',
    admin:      'Rajesh Verma,9876543213,Principal',
    accountant: 'Meena Joshi,9876543214,01/07/2021',
    driver:     'Ramesh Yadav,9876543215,Route 1,MH12AB1234',
  };

  return headers.join(',') + '\n' + examples[role];
}
