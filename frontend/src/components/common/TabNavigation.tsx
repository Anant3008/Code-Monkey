import React from 'react';
import {
  FileText,
  Activity,
  GitBranch,
  AlertTriangle,
  Wrench,
  Download,
} from 'lucide-react';

export type TabId =
  | 'intake'
  | 'orchestration'
  | 'interpretations'
  | 'findings'
  | 'repair'
  | 'export';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  findingCount?: number;
  candidateCount?: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  findingCount = 2,
  candidateCount = 3,
}) => {
  const tabs = [
    {
      id: 'intake' as TabId,
      label: 'Procedure Intake',
      icon: FileText,
      badge: 'Step 1',
    },
    {
      id: 'orchestration' as TabId,
      label: 'Pipeline Orchestrator',
      icon: Activity,
      badge: 'Live',
    },
    {
      id: 'interpretations' as TabId,
      label: 'Competing Plans',
      icon: GitBranch,
      count: candidateCount,
    },
    {
      id: 'findings' as TabId,
      label: 'Divergence & Diffs',
      icon: AlertTriangle,
      count: findingCount,
      alert: findingCount > 0,
    },
    {
      id: 'repair' as TabId,
      label: 'Repair Workspace',
      icon: Wrench,
      badge: 'Verify',
    },
    {
      id: 'export' as TabId,
      label: 'History & Replay',
      icon: Download,
      badge: 'Audit',
    },
  ];

  return (
    <nav className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon
                  size={15}
                  className={isActive ? 'text-sky-400' : 'text-slate-500'}
                />
                <span>{tab.label}</span>

                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                      tab.alert
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}

                {tab.badge && (
                  <span className="hidden md:inline-block ml-1 px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded font-mono bg-white/10 text-slate-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
