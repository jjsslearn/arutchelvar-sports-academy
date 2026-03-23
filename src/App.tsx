import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  Users, 
  Calendar, 
  CreditCard, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Dribbble,
  Menu,
  X,
  Camera,
  Filter,
  FileText,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfDay, differenceInYears } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, storage, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, Student, Fee, Attendance, TeamReport, Activity, Schedule } from './types';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Application Error</h2>
            <p className="text-zinc-600 font-medium">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Application
            </Button>
          </Card>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Auth Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Default profile for new users (coach by default, jjsslearn is admin)
            const isDefaultAdmin = currentUser.email === 'jjsslearn@gmail.com';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'coach'
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Auth state change error", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isCoach = profile?.role === 'coach' || isAdmin;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isCoach, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; 
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-900/20',
    secondary: 'bg-black text-white hover:bg-zinc-800 shadow-black/20',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/20',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100'
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]', className)} {...props}>
    {children}
  </div>
);

const Input = ({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>}
    <input 
      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
      {...props}
    />
  </div>
);

const Select = ({ label, options, ...props }: { label?: string; options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>}
    <select 
      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user, loading, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'fees' | 'attendance' | 'age-categories' | 'reports'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Dribbble className="w-12 h-12 text-orange-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img 
            src="https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090&auto=format&fit=crop" 
            alt="Basketball Court" 
            className="w-full h-full object-cover grayscale"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-xl relative z-10"
        >
          <div className="text-center mb-12 space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-32 h-32 bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,100,0,1)] overflow-hidden">
                <img src="https://i.ibb.co/fzB8dhLQ/PASSIONPOLLACHI-LOGO.jpg" alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-none">
                ARUTCHELVAR <span className="text-orange-600">SPORTS</span>
              </h1>
              <p className="text-xl font-bold uppercase tracking-[0.4em] text-zinc-500 mt-2">Academy</p>
            </motion.div>
          </div>

          <Card className="p-8 lg:p-12 space-y-8 bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Management Portal</h2>
              <p className="text-zinc-500 font-medium">Authorized access for coaches and administrators.</p>
            </div>
            
            <div className="space-y-6">
              <Button onClick={login} className="w-full py-6 text-xl rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                Sign in with Google
              </Button>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-zinc-100">
                <div className="text-center">
                  <p className="text-xl font-black">500+</p>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">Students</p>
                </div>
                <div className="text-center border-x-2 border-zinc-100">
                  <p className="text-xl font-black">15+</p>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">Coaches</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black">10+</p>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">Programs</p>
                </div>
              </div>
            </div>
          </Card>
          
          <p className="text-center mt-8 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            © {new Date().getFullYear()} Arutchelvar Sports Academy • All Rights Reserved
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-black text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-14 h-14 bg-white rounded-lg border-2 border-black overflow-hidden">
              <img src="https://i.ibb.co/fzB8dhLQ/PASSIONPOLLACHI-LOGO.jpg" alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black uppercase tracking-tighter text-xl">Arutchelvar Sports</span>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Dashboard"
            />
            <NavItem 
              active={activeTab === 'students'} 
              onClick={() => { setActiveTab('students'); setIsSidebarOpen(false); }}
              icon={<Users className="w-5 h-5" />}
              label="Students"
            />
            <NavItem 
              active={activeTab === 'fees'} 
              onClick={() => { setActiveTab('fees'); setIsSidebarOpen(false); }}
              icon={<CreditCard className="w-5 h-5" />}
              label="Fees Collection"
            />
            <NavItem 
              active={activeTab === 'attendance'} 
              onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }}
              icon={<Calendar className="w-5 h-5" />}
              label="Attendance"
            />
            <NavItem 
              active={activeTab === 'age-categories'} 
              onClick={() => { setActiveTab('age-categories'); setIsSidebarOpen(false); }}
              icon={<Filter className="w-5 h-5" />}
              label="Age Categories"
            />
            <NavItem 
              active={activeTab === 'reports'} 
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
              icon={<FileText className="w-5 h-5" />}
              label="Team Reports"
            />
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-orange-600" referrerPolicy="no-referrer" />
              <div className="overflow-hidden">
                <p className="font-bold truncate">{user.displayName}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => auth.signOut()} className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900">
              <LogOut className="w-5 h-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white border-b-2 border-black p-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-lg border-2 border-black overflow-hidden">
              <img src="https://i.ibb.co/fzB8dhLQ/PASSIONPOLLACHI-LOGO.jpg" alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black uppercase tracking-tighter">Arutchelvar Sports</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 border-2 border-black rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" />}
            {activeTab === 'students' && <StudentsManagement key="students" />}
            {activeTab === 'fees' && <FeesManagement key="fees" />}
            {activeTab === 'attendance' && <AttendanceManagement key="attendance" />}
            {activeTab === 'age-categories' && <AgeCategoryView key="age-categories" />}
            {activeTab === 'reports' && <ReportsManagement key="reports" />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
        active ? "bg-orange-600 text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Dashboard View ---
function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({ students: 0, activeStudents: 0, feesPaid: 0, todayAttendance: 0 });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const students = snap.docs.map(d => d.data());
      setStats(prev => ({ 
        ...prev, 
        students: snap.size,
        activeStudents: students.filter(s => s.status === 'Active').length
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    const today = format(new Date(), 'yyyy-MM-dd');
    const unsubAttendance = onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (snap) => {
      setStats(prev => ({ ...prev, todayAttendance: snap.docs.filter(d => d.data().status === 'Present').length }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    const unsubFees = onSnapshot(collection(db, 'fees'), (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().status === 'Paid' ? doc.data().amount : 0), 0);
      setStats(prev => ({ ...prev, feesPaid: total }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'fees'));

    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)).sort((a, b) => b.date.localeCompare(a.date)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activities'));

    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'schedules'));

    return () => { unsubStudents(); unsubAttendance(); unsubFees(); unsubActivities(); unsubSchedules(); };
  }, []);

  const handleSaveActivity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      date: new Date().toISOString()
    };

    try {
      if (editingActivity) {
        await updateDoc(doc(db, 'activities', editingActivity.id), data);
      } else {
        await addDoc(collection(db, 'activities'), data);
      }
      setIsAddingActivity(false);
      setEditingActivity(null);
    } catch (error) {
      handleFirestoreError(error, editingActivity ? OperationType.UPDATE : OperationType.CREATE, 'activities');
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      day: formData.get('day') as string,
      title: formData.get('title') as string,
      time: formData.get('time') as string
    };

    try {
      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), data);
      } else {
        await addDoc(collection(db, 'schedules'), data);
      }
      setIsAddingSchedule(false);
      setEditingSchedule(null);
    } catch (error) {
      handleFirestoreError(error, editingSchedule ? OperationType.UPDATE : OperationType.CREATE, 'schedules');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (confirm('Are you sure you want to delete this activity?')) {
      try {
        await deleteDoc(doc(db, 'activities', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'activities');
      }
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'schedules');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black uppercase tracking-tighter">Academy Overview</h2>
        <p className="text-zinc-500 font-medium">Real-time stats for your basketball academy.</p>
      </div>

      {/* Featured Photo Section */}
      <Card className="p-0 overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="relative h-64 md:h-96">
          <img 
            src="https://picsum.photos/seed/basketball-academy-team/1200/600" 
            alt="Academy Team" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
            <div className="text-white">
              <h3 className="text-2xl font-black uppercase tracking-tight">Arutchelvar Sports Academy</h3>
              <p className="font-bold opacity-90">Building champions on and off the court.</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Students" value={stats.students} icon={<Users className="w-6 h-6" />} color="bg-blue-500" />
        <StatCard label="Active Players" value={stats.activeStudents} icon={<Dribbble className="w-6 h-6" />} color="bg-orange-500" />
        <StatCard label="Today's Attendance" value={stats.todayAttendance} icon={<Calendar className="w-6 h-6" />} color="bg-green-500" />
        <StatCard label="Total Fees (₹)" value={stats.feesPaid.toLocaleString()} icon={<CreditCard className="w-6 h-6" />} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase tracking-tight">Recent Activity</h3>
            {isAdmin && (
              <Button variant="ghost" className="p-2" onClick={() => setIsAddingActivity(true)}>
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-zinc-400 italic text-sm">No recent activities.</p>
            ) : (
              activities.map(activity => (
                <div key={activity.id} className="group relative p-3 bg-stone-50 rounded-lg border-2 border-black">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{activity.title}</p>
                      <p className="text-sm text-zinc-600">{activity.description}</p>
                      <p className="text-[10px] font-bold text-zinc-400 mt-1">{format(parseISO(activity.date), 'dd MMM yyyy HH:mm')}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingActivity(activity); setIsAddingActivity(true); }} className="p-1 text-zinc-400 hover:text-black">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteActivity(activity.id)} className="p-1 text-zinc-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase tracking-tight">Upcoming Schedule</h3>
            {isAdmin && (
              <Button variant="ghost" className="p-2" onClick={() => setIsAddingSchedule(true)}>
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <p className="text-zinc-400 italic text-sm">No upcoming schedules.</p>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className="group relative flex items-center gap-4 p-3 bg-stone-50 rounded-lg border-2 border-black">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold shrink-0">
                    {schedule.day.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{schedule.title}</p>
                    <p className="text-xs text-zinc-500">{schedule.time}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingSchedule(schedule); setIsAddingSchedule(true); }} className="p-1 text-zinc-400 hover:text-black">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteSchedule(schedule.id)} className="p-1 text-zinc-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Activity Modal */}
      <AnimatePresence>
        {isAddingActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight">{editingActivity ? 'Edit Activity' : 'Add Activity'}</h3>
                  <button onClick={() => { setIsAddingActivity(false); setEditingActivity(null); }} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleSaveActivity} className="space-y-4">
                  <Input label="Title" name="title" defaultValue={editingActivity?.title} required />
                  <Input label="Description" name="description" defaultValue={editingActivity?.description} required />
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => { setIsAddingActivity(false); setEditingActivity(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Activity</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {isAddingSchedule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight">{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</h3>
                  <button onClick={() => { setIsAddingSchedule(false); setEditingSchedule(null); }} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleSaveSchedule} className="space-y-4">
                  <Select 
                    label="Day" 
                    name="day" 
                    defaultValue={editingSchedule?.day}
                    options={[
                      { value: 'Monday', label: 'Monday' },
                      { value: 'Tuesday', label: 'Tuesday' },
                      { value: 'Wednesday', label: 'Wednesday' },
                      { value: 'Thursday', label: 'Thursday' },
                      { value: 'Friday', label: 'Friday' },
                      { value: 'Saturday', label: 'Saturday' },
                      { value: 'Sunday', label: 'Sunday' }
                    ]} 
                  />
                  <Input label="Title" name="title" defaultValue={editingSchedule?.title} required />
                  <Input label="Time (e.g. 06:00 AM - 08:00 AM)" name="time" defaultValue={editingSchedule?.time} required />
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => { setIsAddingSchedule(false); setEditingSchedule(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Schedule</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={cn("p-3 rounded-xl text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </Card>
  );
}

function StudentForm({ student, onSave, onCancel, uploading }: { student: Student | null; onSave: (e: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; uploading: boolean }) {
  const [dob, setDob] = useState(student?.dob || '');
  const [age, setAge] = useState(student?.age || 0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dob) {
      try {
        const calculatedAge = differenceInYears(new Date(), parseISO(dob));
        setAge(calculatedAge);
      } catch (e) {
        console.error("Invalid date", e);
      }
    }
  }, [dob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <div className="w-24 h-24 bg-zinc-100 rounded-full border-2 border-black flex items-center justify-center overflow-hidden">
            {previewUrl || student?.photoUrl ? (
              <img src={previewUrl || student?.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Camera className="w-8 h-8 text-zinc-400" />
            )}
          </div>
          <input 
            type="file" 
            name="photo" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          className="text-xs h-8"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3 h-3 mr-1" />
          {previewUrl || student?.photoUrl ? 'Change Photo' : 'Upload Photo'}
        </Button>
      </div>
      <Input label="Full Name" name="name" defaultValue={student?.name} required />
      <div className="grid grid-cols-2 gap-4">
        <Input 
          label="Date of Birth" 
          name="dob" 
          type="date" 
          value={dob} 
          onChange={(e) => setDob(e.target.value)} 
          required 
        />
        <Input 
          label="Age (Auto)" 
          name="age" 
          type="number" 
          value={age} 
          readOnly 
          className="bg-zinc-100 cursor-not-allowed"
          required 
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select 
          label="Gender" 
          name="gender" 
          defaultValue={student?.gender}
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other', label: 'Other' }
          ]} 
        />
        <Input label="Contact Number" name="contact" defaultValue={student?.contact} required />
      </div>
      <Input label="Aadhaar Number (12 Digits)" name="aadhaar" defaultValue={student?.aadhaar} minLength={12} maxLength={12} required />
      <Input label="Address" name="address" defaultValue={student?.address} required />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Joined Date" name="joinedDate" type="date" defaultValue={student?.joinedDate || format(new Date(), 'yyyy-MM-dd')} required />
        <Input label="Jersey Number" name="jerseyNumber" defaultValue={student?.jerseyNumber} maxLength={5} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select 
          label="Status" 
          name="status" 
          defaultValue={student?.status}
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' }
          ]} 
        />
        <Select 
          label="Batch" 
          name="batch" 
          defaultValue={student?.batch || 'Morning Batch 1'}
          options={[
            { value: 'Morning Batch 1', label: 'Morning Batch 1' },
            { value: 'Morning Batch 2', label: 'Morning Batch 2' },
            { value: 'Evening Batch 1', label: 'Evening Batch 1' },
            { value: 'Evening Batch 2', label: 'Evening Batch 2' },
            { value: 'Weekend', label: 'Weekend' }
          ]} 
        />
      </div>
      <div className="pt-4 flex gap-3">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Save Player'}
        </Button>
      </div>
    </form>
  );
}

// --- Students Management ---
function StudentsManagement() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));
    return unsub;
  }, []);

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const photoFile = formData.get('photo') as File;
    
    let photoUrl = editingStudent?.photoUrl || '';

    if (photoFile && photoFile.size > 0) {
      setUploading(true);
      try {
        const storageRef = ref(storage, `students/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      } catch (error) {
        console.error('Photo upload failed', error);
      } finally {
        setUploading(false);
      }
    }

    const data = {
      name: formData.get('name') as string,
      dob: formData.get('dob') as string,
      age: Number(formData.get('age')),
      gender: formData.get('gender') as any,
      contact: formData.get('contact') as string,
      address: formData.get('address') as string,
      aadhaar: formData.get('aadhaar') as string,
      joinedDate: formData.get('joinedDate') as string,
      jerseyNumber: formData.get('jerseyNumber') as string,
      status: formData.get('status') as any,
      batch: formData.get('batch') as any,
      photoUrl
    };

    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), data);
      } else {
        await addDoc(collection(db, 'students'), data);
      }
      setIsAdding(false);
      setEditingStudent(null);
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-4xl font-black uppercase tracking-tighter">Student Roster</h2>
          <p className="text-zinc-500 font-medium">Manage players and their details.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAdding(true)} className="md:w-auto w-full">
            <UserPlus className="w-5 h-5" />
            Add Player
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search players by name..." 
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-black rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map(student => (
          <Card key={student.id} className="group relative overflow-hidden">
            <div className={cn(
              "absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-lg border-l-2 border-b-2 border-black",
              student.status === 'Active' ? "bg-green-500 text-white" : "bg-zinc-200 text-zinc-500"
            )}>
              {student.status}
            </div>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center border-2 border-black text-2xl font-black text-orange-600 overflow-hidden">
                {student.photoUrl ? (
                  <img src={student.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  student.name.charAt(0)
                )}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-xl font-black uppercase leading-none">{student.name}</h4>
                <p className="text-sm font-bold text-zinc-500">{student.age} Years • {student.gender} • #{student.jerseyNumber || '??'}</p>
                <div className="pt-2 space-y-1">
                  <p className="text-xs font-bold text-zinc-400 uppercase">Contact & Aadhaar</p>
                  <p className="text-sm font-bold">{student.contact} • {student.aadhaar}</p>
                  <p className="text-xs font-bold text-zinc-400 uppercase mt-1">Address</p>
                  <p className="text-xs font-medium text-zinc-600 line-clamp-1">{student.address}</p>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="mt-6 pt-4 border-t-2 border-black flex gap-2">
                <Button variant="ghost" className="flex-1 text-xs" onClick={() => { setEditingStudent(student); setIsAdding(true); }}>
                  <Edit2 className="w-4 h-4" /> Edit
                </Button>
                <Button variant="ghost" className="flex-1 text-xs text-red-600 hover:bg-red-50" onClick={() => handleDelete(student.id)}>
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg"
            >
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight">
                    {editingStudent ? 'Edit Player' : 'New Player'}
                  </h3>
                  <button onClick={() => { setIsAdding(false); setEditingStudent(null); }} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <StudentForm 
                  student={editingStudent} 
                  onSave={handleSave} 
                  onCancel={() => { setIsAdding(false); setEditingStudent(null); }} 
                  uploading={uploading} 
                />
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Fees Management ---
function FeesManagement() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MMMM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));
    const unsubFees = onSnapshot(collection(db, 'fees'), (snap) => {
      setFees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fee)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'fees'));
    return () => { unsubStudents(); unsubFees(); };
  }, []);

  const handleCollectFee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      studentId: formData.get('studentId') as string,
      amount: Number(formData.get('amount')),
      date: formData.get('date') as string,
      month: formData.get('month') as string,
      year: Number(formData.get('year')),
      status: 'Paid' as const,
    };

    try {
      await addDoc(collection(db, 'fees'), data);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'fees');
    }
  };

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-4xl font-black uppercase tracking-tighter">Fees Collection</h2>
          <p className="text-zinc-500 font-medium">Track payments and manage academy revenue.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAdding(true)} className="md:w-auto w-full">
            <Plus className="w-5 h-5" />
            Collect Fee
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-full md:w-48">
          <Select 
            label="Month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={months.map(m => ({ value: m, label: m }))} 
          />
        </div>
        <div className="w-full md:w-32">
          <Select 
            label="Year" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={years.map(y => ({ value: String(y), label: String(y) }))} 
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-white uppercase text-xs font-black tracking-widest">
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {fees.filter(f => f.month === selectedMonth && f.year === selectedYear).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold italic">No records found for this period.</td>
                </tr>
              ) : (
                fees.filter(f => f.month === selectedMonth && f.year === selectedYear).map(fee => {
                  const student = students.find(s => s.id === fee.studentId);
                  return (
                    <tr key={fee.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-6 py-4 font-black uppercase">{student?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 font-bold">₹{fee.amount}</td>
                      <td className="px-6 py-4 text-zinc-500 font-medium">{format(parseISO(fee.date), 'dd MMM yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200">
                          {fee.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Collect Fee Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg"
            >
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight">Collect Fee</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleCollectFee} className="space-y-4">
                  <Select 
                    label="Select Student" 
                    name="studentId" 
                    required
                    options={students.filter(s => s.status === 'Active').map(s => ({ value: s.id, label: s.name }))} 
                  />
                  <Input label="Amount (₹)" name="amount" type="number" defaultValue={500} required />
                  <Input label="Payment Date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                  <div className="grid grid-cols-2 gap-4">
                    <Select 
                      label="For Month" 
                      name="month" 
                      defaultValue={selectedMonth}
                      options={months.map(m => ({ value: m, label: m }))} 
                    />
                    <Select 
                      label="For Year" 
                      name="year" 
                      defaultValue={String(selectedYear)}
                      options={years.map(y => ({ value: String(y), label: String(y) }))} 
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Confirm Payment</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Attendance Management ---
function AttendanceManagement() {
  const { isCoach } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBatch, setSelectedBatch] = useState<'Morning Batch 1' | 'Morning Batch 2' | 'Evening Batch 1' | 'Evening Batch 2' | 'Weekend'>('Morning Batch 1');
  const [viewingStats, setViewingStats] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)).filter(s => s.status === 'Active'));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));
    
    const unsubAttendance = onSnapshot(query(collection(db, 'attendance'), where('date', '==', selectedDate)), (snap) => {
      setAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    const unsubAllAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAllAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => { unsubStudents(); unsubAttendance(); unsubAllAttendance(); };
  }, [selectedDate]);

  const filteredStudents = students.filter(s => s.batch === selectedBatch);

  const toggleAttendance = async (studentId: string, currentStatus?: 'Present' | 'Absent') => {
    if (!isCoach) return;
    const existing = attendance.find(a => a.studentId === studentId);
    const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';

    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status: newStatus });
      } else {
        await addDoc(collection(db, 'attendance'), {
          studentId,
          date: selectedDate,
          status: 'Present'
        });
      }
    } catch (error) {
      handleFirestoreError(error, existing ? OperationType.UPDATE : OperationType.CREATE, 'attendance');
    }
  };

  const markBatchPresent = async () => {
    if (!isCoach) return;
    if (!confirm(`Mark all students in ${selectedBatch} batch as Present?`)) return;

    for (const student of filteredStudents) {
      const existing = attendance.find(a => a.studentId === student.id);
      if (!existing) {
        try {
          await addDoc(collection(db, 'attendance'), {
            studentId: student.id,
            date: selectedDate,
            status: 'Present'
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'attendance');
        }
      } else if (existing.status === 'Absent') {
        try {
          await updateDoc(doc(db, 'attendance', existing.id), { status: 'Present' });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'attendance');
        }
      }
    }
  };

  const showStudentStats = (student: Student) => {
    const count = allAttendance.filter(a => a.studentId === student.id && a.status === 'Present').length;
    setViewingStats({ name: student.name, count });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-4xl font-black uppercase tracking-tighter">Attendance Log</h2>
          <p className="text-zinc-500 font-medium">Mark daily presence of academy players.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="w-full md:w-48">
            <Select 
              label="Select Batch" 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value as any)}
              options={[
                { value: 'Morning Batch 1', label: 'Morning Batch 1' },
                { value: 'Morning Batch 2', label: 'Morning Batch 2' },
                { value: 'Evening Batch 1', label: 'Evening Batch 1' },
                { value: 'Evening Batch 2', label: 'Evening Batch 2' },
                { value: 'Weekend', label: 'Weekend' }
              ]}
            />
          </div>
          <div className="w-full md:w-48">
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        {isCoach && (
          <Button onClick={markBatchPresent} variant="secondary" className="bg-green-600 text-white hover:bg-green-700 border-green-800">
            Mark All {selectedBatch} Present
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400 font-bold italic border-2 border-dashed border-zinc-200 rounded-xl">
            No active students found in {selectedBatch} batch.
          </div>
        ) : (
          filteredStudents.map(student => {
            const record = attendance.find(a => a.studentId === student.id);
            const isPresent = record?.status === 'Present';
            const isAbsent = record?.status === 'Absent';

            return (
              <div key={student.id} className="flex flex-col gap-2">
                <button 
                  disabled={!isCoach}
                  onClick={() => toggleAttendance(student.id, record?.status)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 border-black transition-all active:scale-95 text-left w-full",
                    isPresent ? "bg-green-500 text-white shadow-[4px_4px_0px_0px_rgba(34,197,94,0.3)]" : 
                    isAbsent ? "bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(239,68,68,0.3)]" : 
                    "bg-white hover:bg-zinc-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-black border-2 border-black",
                      isPresent || isAbsent ? "bg-white/20" : "bg-zinc-100 text-orange-600"
                    )}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm">{student.name}</p>
                      <p className={cn("text-[10px] font-bold uppercase", isPresent || isAbsent ? "text-white/70" : "text-zinc-400")}>
                        {record ? record.status : 'Not Marked'}
                      </p>
                    </div>
                  </div>
                  {isPresent && <CheckCircle2 className="w-6 h-6" />}
                  {isAbsent && <XCircle className="w-6 h-6" />}
                  {!record && <div className="w-6 h-6 rounded-full border-2 border-black/20" />}
                </button>
                <button 
                  onClick={() => showStudentStats(student)}
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors text-right px-2"
                >
                  View Attendance Stats
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Stats Modal */}
      <AnimatePresence>
        {viewingStats && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-xs">
              <Card className="text-center space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black uppercase tracking-tight">Player Stats</h3>
                  <button onClick={() => setViewingStats(null)}><X className="w-5 h-5" /></button>
                </div>
                <div className="py-6">
                  <p className="text-zinc-500 font-bold uppercase text-xs">Total Days Attended</p>
                  <p className="text-6xl font-black text-orange-600 mt-2">{viewingStats.count}</p>
                  <p className="text-sm font-bold uppercase mt-4">{viewingStats.name}</p>
                </div>
                <Button onClick={() => setViewingStats(null)} className="w-full">Close</Button>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Reports Management ---
function ReportsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<TeamReport[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [coachName, setCoachName] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [secretaryName, setSecretaryName] = useState('');
  const [academyName, setAcademyName] = useState('Arutchelvar Sports Academy');
  const [academyAddress, setAcademyAddress] = useState('Academy Address, City');
  const [academyContact, setAcademyContact] = useState('+91 12345 67890');
  const [viewingReport, setViewingReport] = useState<TeamReport | null>(null);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)).filter(s => s.status === 'Active'));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    const unsubReports = onSnapshot(collection(db, 'team-reports'), (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamReport)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'team-reports'));

    return () => { unsubStudents(); unsubReports(); };
  }, []);

  const handleGenerate = async () => {
    if (selectedPlayers.length < 5 || selectedPlayers.length > 12) {
      alert('Please select between 5 and 12 players.');
      return;
    }
    if (!coachName || !presidentName || !secretaryName) {
      alert('Please enter coach, president, and secretary names.');
      return;
    }

    const reportPlayers = selectedPlayers.map(id => {
      const s = students.find(st => st.id === id)!;
      return {
        studentId: s.id,
        name: s.name,
        jerseyNumber: s.jerseyNumber || ''
      };
    });

    const newReport = {
      academyName,
      academyAddress,
      academyContact,
      coachName,
      presidentName,
      secretaryName,
      players: reportPlayers,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'team-reports'), newReport);
      setIsGenerating(false);
      setSelectedPlayers([]);
      setCoachName('');
      setPresidentName('');
      setSecretaryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'team-reports');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-4xl font-black uppercase tracking-tighter">Team Reports</h2>
          <p className="text-zinc-500 font-medium">Generate and view team sheets for tournaments.</p>
        </div>
        <Button onClick={() => setIsGenerating(true)} className="md:w-auto w-full">
          <Plus className="w-5 h-5" />
          Generate Team Sheet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map(report => (
          <Card key={report.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-zinc-400">{format(parseISO(report.createdAt), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <h4 className="font-black uppercase truncate">{report.academyName}</h4>
              <p className="text-sm font-bold text-zinc-500">Coach: {report.coachName}</p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setViewingReport(report)}>
              View Report
            </Button>
          </Card>
        ))}
      </div>

      {/* Generator Modal */}
      <AnimatePresence>
        {isGenerating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight">Generate Team Sheet</h3>
                  <button onClick={() => setIsGenerating(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h5 className="font-black uppercase text-sm border-b-2 border-black pb-1">Academy Details</h5>
                    <Input label="Academy Name" value={academyName} onChange={(e) => setAcademyName(e.target.value)} />
                    <Input label="Address" value={academyAddress} onChange={(e) => setAcademyAddress(e.target.value)} />
                    <Input label="Academy Contact" value={academyContact} onChange={(e) => setAcademyContact(e.target.value)} />
                    <Input label="Coach Name" value={coachName} onChange={(e) => setCoachName(e.target.value)} />
                    <Input label="President Name" value={presidentName} onChange={(e) => setPresidentName(e.target.value)} />
                    <Input label="Secretary Name" value={secretaryName} onChange={(e) => setSecretaryName(e.target.value)} />
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-black uppercase text-sm border-b-2 border-black pb-1">Select 5-12 Players ({selectedPlayers.length})</h5>
                    <div className="max-h-64 overflow-y-auto border-2 border-black rounded-lg p-2 space-y-2">
                      {students.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 border-2 border-black rounded accent-orange-600"
                            checked={selectedPlayers.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedPlayers.length < 12) setSelectedPlayers([...selectedPlayers, s.id]);
                              } else {
                                setSelectedPlayers(selectedPlayers.filter(id => id !== s.id));
                              }
                            }}
                          />
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold">Jersey: {s.jerseyNumber || 'N/A'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setIsGenerating(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleGenerate} disabled={selectedPlayers.length < 5}>
                    Generate Report
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Viewer Modal */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="p-0 overflow-hidden">
                <div className="p-8 space-y-8 bg-white" id="printable-report">
                  <div className="text-center space-y-2 border-b-4 border-black pb-6">
                    <h1 className="text-4xl font-black uppercase tracking-tighter">{viewingReport.academyName}</h1>
                    <p className="font-bold text-zinc-600">{viewingReport.academyAddress}</p>
                    <p className="font-bold text-zinc-600">Contact: {viewingReport.academyContact}</p>
                  </div>

                  <div className="flex justify-between items-center py-4 border-b-2 border-black">
                    <div>
                      <p className="text-xs font-black uppercase text-zinc-400">Coach Name</p>
                      <p className="text-xl font-black uppercase">{viewingReport.coachName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase text-zinc-400">Date Generated</p>
                      <p className="font-bold">{format(parseISO(viewingReport.createdAt), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-center font-black uppercase tracking-widest bg-black text-white py-2">Team Player List</h3>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black">
                          <th className="py-2 text-left font-black uppercase text-sm">S.No</th>
                          <th className="py-2 text-left font-black uppercase text-sm">Player Name</th>
                          <th className="py-2 text-center font-black uppercase text-sm">Jersey No</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {viewingReport.players.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-3 font-bold">{idx + 1}</td>
                            <td className="py-3 font-black uppercase">{p.name}</td>
                            <td className="py-3 text-center font-black text-orange-600">{p.jerseyNumber || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-12 flex justify-between">
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-black mb-2 mx-auto"></div>
                      <p className="text-[10px] font-black uppercase">Coach</p>
                      <p className="text-xs font-bold">{viewingReport.coachName}</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-black mb-2 mx-auto"></div>
                      <p className="text-[10px] font-black uppercase">Secretary</p>
                      <p className="text-xs font-bold">{viewingReport.secretaryName}</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-black mb-2 mx-auto"></div>
                      <p className="text-[10px] font-black uppercase">President</p>
                      <p className="text-xs font-bold">{viewingReport.presidentName}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 border-t-2 border-black flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setViewingReport(null)}>Close</Button>
                  <Button className="flex-1" onClick={() => window.print()}>Print Report</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Age Category View ---
function AgeCategoryView() {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));
    return unsub;
  }, []);

  const categories = [
    { name: 'Under 10 (U-10)', filter: (s: Student) => s.age < 10 },
    { name: 'Under 12 (U-12)', filter: (s: Student) => s.age >= 10 && s.age < 12 },
    { name: 'Under 14 (U-14)', filter: (s: Student) => s.age >= 12 && s.age < 14 },
    { name: 'Under 16 (U-16)', filter: (s: Student) => s.age >= 14 && s.age < 16 },
    { name: 'Under 18 (U-18)', filter: (s: Student) => s.age >= 16 && s.age < 18 },
    { name: 'Seniors (18+)', filter: (s: Student) => s.age >= 18 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-black uppercase tracking-tighter">Age Categories</h2>
        <p className="text-zinc-500 font-medium">Players grouped by their age brackets.</p>
      </div>

      <div className="space-y-12">
        {categories.map(cat => {
          const catStudents = students.filter(cat.filter);
          if (catStudents.length === 0) return null;

          return (
            <div key={cat.name} className="space-y-4">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-black uppercase tracking-tight">{cat.name}</h3>
                <div className="flex-1 h-1 bg-black rounded-full" />
                <span className="px-3 py-1 bg-black text-white rounded-lg font-bold text-sm">
                  {catStudents.length} Players
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catStudents.map(student => (
                  <Card key={student.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center border-2 border-black overflow-hidden shrink-0">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-black text-orange-600">{student.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm">{student.name}</p>
                      <p className="text-xs font-bold text-zinc-500">{student.age} Years Old</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
        
        {students.length === 0 && (
          <Card className="text-center py-12">
            <p className="text-zinc-400 font-bold italic">No students registered yet.</p>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

