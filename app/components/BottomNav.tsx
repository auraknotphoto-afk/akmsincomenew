'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Camera, Sparkles, Briefcase, FileText, Settings } from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Camera, label: 'Exposing', path: '/jobs/exposing' },
  { icon: Sparkles, label: 'Editing', path: '/jobs/editing' },
  { icon: Briefcase, label: 'Other', path: '/jobs/other' },
  { icon: FileText, label: 'Reports', path: '/reports' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on login page
  if (pathname === '/login' || pathname === '/auth/login' || pathname === '/') {
    return null;
  }

  return (
    <nav className="bottom-nav md:hidden glass border-t border-white/10">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all ${
                isActive 
                  ? 'text-purple-400 bg-purple-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
