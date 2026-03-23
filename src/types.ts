export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'coach';
}

export interface Student {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  contact: string;
  address: string;
  aadhaar: string;
  joinedDate: string;
  status: 'Active' | 'Inactive';
  photoUrl?: string;
  jerseyNumber?: string;
  batch: 'Morning Batch 1' | 'Morning Batch 2' | 'Evening Batch 1' | 'Evening Batch 2' | 'Weekend';
}

export interface TeamReport {
  id: string;
  academyName: string;
  academyAddress: string;
  academyContact: string;
  coachName: string;
  presidentName: string;
  secretaryName: string;
  players: {
    studentId: string;
    name: string;
    jerseyNumber: string;
  }[];
  createdAt: string;
}

export interface Fee {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  month: string;
  year: number;
  status: 'Paid' | 'Pending';
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: 'Present' | 'Absent';
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
}

export interface Schedule {
  id: string;
  day: string;
  title: string;
  time: string;
}
