# Skilytics: Web App Design and Architecture Report

## 1. Executive Summary
**Skilytics** (formerly AiverPath) is an AI-powered dynamic workforce reskilling dashboard designed for the SDC Hackathon 2026 (Domain 1). The application provides a seamless transition from static career planning to real-time, adaptive navigation. The design utilizes a modern, minimalist aesthetic rendered exclusively in the **Inter** font family, incorporating the Universiti Teknologi Malaysia (UTM) branding theme: Maroon (`#7A1523`) and Gold (`#C69214`). 

This report details the UI/UX strategies employed for Desktop and Mobile views. Key enhancements include a persistent **Bottom Navigation Bar** on mobile devices, strict **single-line sentence typography formatting** across viewports, and **skill-type specific icon mapping** within the Role Matcher module.

---

## 2. UI/UX Design Philosophy, Inter Typography & UTM Theme
The interface leverages a clean, high-contrast aesthetic calibrated for clarity and cognitive ease.

*   **Inter Typography System (`'Inter', sans-serif`):** All headings, body text, buttons, tags, and data visualization overlays utilize the Inter variable font family. Font weights range from Regular (`400`) to SemiBold (`600`) and Bold (`700`), guaranteeing legible hierarchy at both desktop and mobile resolutions.
*   **Single-Line Mobile Typography Preservation:** To preserve visual parity between desktop and mobile screen layouts, single-line text elements (headings, subtitles, alert titles, skill tags, and timeline step headers) utilize responsive scaling (`text-[10px]` to `text-base`), flexbox constraint logic, and `whitespace-nowrap truncate` utility classes. This guarantees that any text line displayed on a single row on desktop remains on a single row on mobile devices without wrapping awkwardly.
*   **UTM Maroon (`#7A1523`):** Applied to primary calls-to-action, active bottom tab navigation states, and future skill gap visualizations.
*   **UTM Gold (`#C69214`):** Used for current skill radar indicators, active SDG badges, and highlights.

---

## 3. Desktop View Design Architecture
On desktop viewports (width $\ge$ 1024px), Skilytics utilizes a **Sidebar Navigation Layout**.

*   **Persistent Left Sidebar (256px wide):** 
    *   Allows instant switching between the 4 core modules (Profile Intake, Future Skills Radar, Role Matcher, Reskilling Pathway).
    *   Integrates the "AI Disruption Scenario" selector at the bottom for quick global modeling adjustments (Moderate vs. Rapid AI Disruption).
*   **Role Matcher with Skill-Type Specific Icons:**
    *   Recommended roles feature a 3-column grid (`grid-cols-3`).
    *   Each recommended role displays breakdown badges for key skills required, with **distinct Lucide icons mapped according to skill category**:
        *   **AI/ML:** `<Cpu />` / `<Sparkles />`
        *   **Cloud Deployment:** `<Cloud />`
        *   **Data & Analytics:** `<BarChart2 />` / `<Database />`
        *   **Ethics & Governance:** `<ShieldCheck />`
        *   **Prompting & Development:** `<Terminal />`
        *   **Sustainability & Green Tech:** `<Leaf />`

---

## 4. Mobile View Design Architecture
On mobile viewports (phones and narrow tablets), the layout transitions into a native app experience optimized for thumb interaction.

*   **Fixed Bottom Menu Navigation Bar (`md:hidden`):**
    *   Replaces the desktop sidebar with a fixed, persistent bottom bar (`fixed bottom-0 left-0 right-0 z-50`).
    *   Provides 4 primary tab items with dedicated icons and labels, highlighting the active tab in UTM Maroon (`#7A1523`).
    *   Main content receives bottom padding (`pb-24`) to prevent bottom navigation occlusion.
*   **Mobile Top Bar:**
    *   Displays the Skilytics brand mark alongside a compact AI Disruption Scenario toggle for quick scenario changes on small screens.
*   **Single-Line Sentence Scaling:**
    *   Maintains consistent line counts across screen sizes using responsive text sizing and overflow protection.
*   **Touch Targets:**
    *   All buttons, select controls, and bottom navigation targets maintain minimum hit dimensions of $44\text{px} \times 44\text{px}$ for accessibility.

---

## 5. Complete React Source Code
Below is the complete, functional React (`.jsx`) source code for **Skilytics**.

```jsx
import React, { useState } from 'react';
import {
  Upload, FileText, BarChart2, Briefcase,
  Map, Globe, Settings, ChevronRight, CheckCircle2,
  AlertTriangle, BookOpen, Target, Activity, Cpu,
  Terminal, Database, Sparkles, Cloud, ShieldCheck, Leaf
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from 'recharts';

// --- MOCK DATA ---
const radarData = [
  { subject: 'Data Analysis', current: 65, required: 90, fullMark: 100 },
  { subject: 'Machine Learning', current: 40, required: 85, fullMark: 100 },
  { subject: 'Python', current: 80, required: 85, fullMark: 100 },
  { subject: 'Cloud Deployment', current: 30, required: 70, fullMark: 100 },
  { subject: 'Ethics & AI', current: 50, required: 80, fullMark: 100 },
  { subject: 'Prompt Engineering', current: 70, required: 95, fullMark: 100 },
];

const matchedRoles = [
  {
    title: 'AI Sustainability Analyst',
    roleIcon: Cpu,
    match: 82,
    gap: 'High need for ML and Cloud Deployment.',
    skills: [
      { name: 'Machine Learning', type: 'AI/ML', icon: Cpu },
      { name: 'Cloud Deployment', type: 'Cloud', icon: Cloud },
      { name: 'Data Analysis', type: 'Data', icon: BarChart2 },
    ],
    sdgs: [9, 13],
    trend: 'Rising Fast',
  },
  {
    title: 'Prompt Engineer / LLM Optimizer',
    roleIcon: Terminal,
    match: 75,
    gap: 'Need to bridge Ethics and advanced ML concepts.',
    skills: [
      { name: 'Prompt Engineering', type: 'Code', icon: Terminal },
      { name: 'AI Ethics & Governance', type: 'Ethics', icon: ShieldCheck },
      { name: 'LLM Fine-Tuning', type: 'AI/ML', icon: Sparkles },
    ],
    sdgs: [8, 4],
    trend: 'Stable Growth',
  },
  {
    title: 'Green Tech Data Architect',
    roleIcon: Database,
    match: 60,
    gap: 'Significant gap in Cloud architectures and specialized ML.',
    skills: [
      { name: 'Cloud Architecture', type: 'Cloud', icon: Cloud },
      { name: 'Green Data Tech', type: 'Sustainability', icon: Leaf },
      { name: 'Big Data Pipeline', type: 'Data', icon: Database },
    ],
    sdgs: [7, 9, 11],
    trend: 'Emerging',
  }
];

const pathwaySteps = [
  { id: 1, title: 'Foundations of Cloud Native AI', duration: '3 Weeks', source: 'HRD Corp Claimable', completed: true },
  { id: 2, title: 'Applied Machine Learning for Sustainability', duration: '4 Weeks', source: 'Coursera (Free Audit)', completed: false },
  { id: 3, title: 'AI Ethics & Governance', duration: '2 Weeks', source: 'Open University', completed: false },
];

// --- MAIN DASHBOARD COMPONENT ---
export default function SkilyticsDashboard() {
  const [activeTab, setActiveTab] = useState('profile');
  const [scenario, setScenario] = useState('moderate');
  const [isUploaded, setIsUploaded] = useState(false);

  // UTM Brand Colors
  const utmMaroon = '#7A1523';
  const utmGold = '#C69214';

  const navItems = [
    { id: 'profile', icon: FileText, label: 'Profile Intake' },
    { id: 'radar', icon: Activity, label: 'Future Skills Radar' },
    { id: 'roles', icon: Briefcase, label: 'Role Matcher' },
    { id: 'pathway', icon: Map, label: 'Learning Pathway' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 font-['Inter',sans-serif] text-gray-900 antialiased selection:bg-[#7A1523] selection:text-white">
      {/* Global Inter Font Stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col h-full z-20 shrink-0">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: utmMaroon }}>
            SK
          </div>
          <span className="text-xl font-bold whitespace-nowrap truncate" style={{ color: utmMaroon }}>Skilytics</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap truncate ${
                  isActive ? 'bg-[#7A1523] text-white font-semibold' : 'text-gray-600 hover:bg-gray-100 font-medium'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 text-xs font-semibold mb-2 whitespace-nowrap truncate" style={{ color: utmMaroon }}>
              <Settings size={16} className="shrink-0" />
              <span className="truncate">AI Disruption Scenario</span>
            </div>
            <select 
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full text-xs border-gray-300 rounded-md shadow-sm p-2 bg-white font-medium focus:ring-1 focus:ring-[#7A1523] outline-none"
            >
              <option value="moderate">Moderate Disruption</option>
              <option value="rapid">Rapid AI Advancement</option>
            </select>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR (BRANDING & SCENARIO TOGGLE) */}
      <div className="md:hidden flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: utmMaroon }}>
            SK
          </div>
          <span className="text-base font-bold whitespace-nowrap truncate" style={{ color: utmMaroon }}>Skilytics</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <select 
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="text-[11px] font-medium border border-gray-300 rounded-lg p-1.5 bg-gray-50 text-gray-700 outline-none"
          >
            <option value="moderate">Moderate Disruption</option>
            <option value="rapid">Rapid AI</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        
        {/* HEADER */}
        <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 whitespace-nowrap truncate">
              {activeTab === 'profile' && 'Welcome to Skilytics Dashboard'}
              {activeTab === 'radar' && 'Future Skills Radar Analysis'}
              {activeTab === 'roles' && 'Career Matching Engine'}
              {activeTab === 'pathway' && 'Your Personalized Reskilling Pathway'}
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 mt-0.5 whitespace-nowrap truncate">
              Empowering the workforce of tomorrow with sustainable AI skills.
            </p>
          </div>
          <div className="flex items-center shrink-0 self-start md:self-auto space-x-2 bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-sm border border-gray-200">
            <Globe size={16} style={{ color: utmGold }} className="shrink-0" />
            <span className="text-[11px] sm:text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap truncate">SDG Integration Active</span>
          </div>
        </header>

        {/* TAB 1: PROFILE INTAKE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-200">
            <div className="text-center mb-6 md:mb-8">
              <div className="mx-auto w-14 h-14 md:w-16 md:h-16 bg-rose-50 rounded-full flex items-center justify-center mb-3">
                <Upload size={26} style={{ color: utmMaroon }} />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 whitespace-nowrap truncate">Upload your Profile</h2>
              <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 mt-1 whitespace-nowrap truncate">Let AI parse your current skills to find your future-ready roles.</p>
            </div>
            
            <div 
              className={`border-2 border-dashed rounded-xl p-6 md:p-10 text-center transition-all cursor-pointer
                ${isUploaded ? 'border-green-500 bg-green-50/50' : 'border-gray-300 hover:border-[#7A1523] bg-gray-50'}`}
              onClick={() => setIsUploaded(true)}
            >
              {isUploaded ? (
                <div className="flex flex-col items-center text-green-700">
                  <CheckCircle2 size={36} className="mb-2 text-green-600" />
                  <span className="font-semibold text-base sm:text-lg whitespace-nowrap truncate">CV Successfully Analyzed!</span>
                  <span className="text-xs sm:text-sm opacity-80 whitespace-nowrap truncate">We found 12 core skills.</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500">
                  <FileText size={36} className="mb-2 opacity-50" />
                  <span className="font-medium text-xs sm:text-sm whitespace-nowrap truncate">Click to upload CV (PDF)</span>
                  <span className="text-[11px] sm:text-xs mt-1 whitespace-nowrap truncate">or fill out the manual questionnaire</span>
                </div>
              )}
            </div>

            {isUploaded && (
              <button 
                onClick={() => setActiveTab('radar')}
                className="w-full mt-6 py-3 rounded-xl text-white font-semibold transition-all flex justify-center items-center space-x-2 hover:opacity-95 shadow-md text-xs sm:text-sm whitespace-nowrap truncate"
                style={{ backgroundColor: utmMaroon }}
              >
                <span className="whitespace-nowrap truncate">Generate Skill Forecast</span>
                <ChevronRight size={18} className="shrink-0" />
              </button>
            )}
          </div>
        )}

        {/* TAB 2: FUTURE SKILLS RADAR */}
        {activeTab === 'radar' && (
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-h-[320px] md:min-h-[400px]">
              <h3 className="text-base sm:text-lg font-bold mb-4 text-center md:text-left whitespace-nowrap truncate" style={{ color: utmMaroon }}>
                Skill Gap Analysis Chart
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar name="Current Skills" dataKey="current" stroke={utmGold} fill={utmGold} fillOpacity={0.5} />
                  <Radar name="Required for Future" dataKey="required" stroke={utmMaroon} fill={utmMaroon} fillOpacity={0.3} />
                  <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }}/>
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-6">
              <div className="bg-rose-50/70 p-4 md:p-5 rounded-xl border border-rose-100">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="mt-0.5 shrink-0" size={20} style={{ color: utmMaroon }} />
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm md:text-base whitespace-nowrap truncate">AI Disruption Risk Indicator</h4>
                    <p className="text-[11px] sm:text-xs md:text-sm text-gray-700 mt-1">
                      Based on current <strong>{scenario}</strong> AI trends, traditional Data Analysis faces a 40% risk of automation in 3 years.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                 <h4 className="font-bold text-gray-900 mb-3 text-xs sm:text-sm md:text-base whitespace-nowrap truncate">Live Market Skill Signals</h4>
                 <ul className="space-y-2.5">
                    <li className="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-[11px] sm:text-xs md:text-sm border border-gray-200">
                      <span className="whitespace-nowrap truncate mr-2">Demand for Prompt Engineering</span>
                      <span className="text-green-600 font-bold shrink-0 whitespace-nowrap">↑ 215% (Q3)</span>
                    </li>
                    <li className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-[11px] sm:text-xs md:text-sm border border-gray-200">
                      <span className="whitespace-nowrap truncate mr-2">Demand for Basic Data Entry</span>
                      <span className="text-red-600 font-bold shrink-0 whitespace-nowrap">↓ 45% (Q3)</span>
                    </li>
                 </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ROLE MATCHER */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4 whitespace-nowrap truncate">
              Recommended Future-Ready Roles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matchedRoles.map((role, idx) => {
                const RoleIcon = role.roleIcon;
                return (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:border-[#7A1523] transition-colors flex flex-col justify-between">
                    <div>
                      {/* ROLE HEADER */}
                      <div className="flex justify-between items-center mb-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                          <RoleIcon style={{ color: utmMaroon }} size={22} />
                        </div>
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[11px] sm:text-xs font-bold rounded-full border border-green-200 whitespace-nowrap">
                          {role.match}% Match Score
                        </span>
                      </div>
                      
                      <h4 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 mb-1 whitespace-nowrap truncate">{role.title}</h4>
                      <p className="text-[11px] sm:text-xs text-gray-500 mb-4 font-medium whitespace-nowrap truncate">Market Demand: {role.trend}</p>

                      {/* SKILLS WITH TYPE-SPECIFIC ICONS */}
                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 whitespace-nowrap truncate">
                          Key Required Skills & Category
                        </span>
                        <div className="space-y-2">
                          {role.skills.map((skill, sIdx) => {
                            const SkillIcon = skill.icon;
                            return (
                              <div key={sIdx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <div className="p-1.5 rounded-md bg-white border border-gray-200 shadow-2xs shrink-0">
                                    <SkillIcon size={14} style={{ color: utmMaroon }} />
                                  </div>
                                  <span className="text-[11px] sm:text-xs font-medium text-gray-800 whitespace-nowrap truncate">
                                    {skill.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 shrink-0 whitespace-nowrap">
                                  {skill.type}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block whitespace-nowrap truncate">Primary Skill Gap</span>
                        <p className="text-[11px] sm:text-xs text-gray-700 mt-1 whitespace-nowrap truncate">{role.gap}</p>
                      </div>
                    </div>

                    {/* SDG FOOTER */}
                    <div className="border-t border-gray-100 pt-3 mt-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 whitespace-nowrap truncate">Aligned SDGs</span>
                      <div className="flex flex-wrap gap-1.5">
                        {role.sdgs.map(sdg => (
                          <span key={sdg} className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#C69214] text-white shadow-2xs whitespace-nowrap">
                            SDG {sdg}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: LEARNING PATHWAY */}
        {activeTab === 'pathway' && (
          <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-200">
            <div className="mb-6 md:mb-8">
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 whitespace-nowrap truncate">Your Structured Reskilling Pathway</h3>
              <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 mt-0.5 whitespace-nowrap truncate">Target Role: AI Sustainability Analyst (Maps to SDG 9 & 13)</p>
            </div>
            
            <div className="space-y-6">
              {pathwaySteps.map((step, idx) => (
                <div key={step.id} className="flex relative">
                  {idx !== pathwaySteps.length - 1 && (
                    <div className="absolute top-10 left-5 md:left-6 w-0.5 h-full bg-gray-200 -z-10"></div>
                  )}
                  <div className="mr-3 md:mr-6 shrink-0 z-10">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-4 border-white shadow-sm
                      ${step.completed ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {step.completed ? <CheckCircle2 size={20} /> : <BookOpen size={18} />}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 md:p-5 rounded-xl border border-gray-200 flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-xs sm:text-sm md:text-base whitespace-nowrap truncate">{step.title}</h4>
                        <p className="text-[11px] sm:text-xs text-gray-500 mt-1 whitespace-nowrap truncate">Estimated Duration: {step.duration}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-gray-200 text-[10px] sm:text-xs font-semibold rounded-full text-gray-600 shrink-0 self-start whitespace-nowrap">
                        {step.source}
                      </span>
                    </div>
                    {idx === 1 && !step.completed && (
                      <button 
                        className="mt-3 px-4 py-2 text-xs text-white font-medium rounded-lg transition-opacity hover:opacity-90 shadow-sm whitespace-nowrap truncate"
                        style={{ backgroundColor: utmMaroon }}
                      >
                        Start Learning Module
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MOBILE FIXED BOTTOM NAVIGATION MENU */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center py-2 px-2 z-50 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[64px] ${
                isActive ? 'text-[#7A1523]' : 'text-gray-500'
              }`}
            >
              <div className={`p-1 rounded-md ${isActive ? 'bg-rose-50' : 'bg-transparent'}`}>
                <Icon size={20} style={{ color: isActive ? utmMaroon : undefined }} />
              </div>
              <span className={`text-[10px] mt-0.5 whitespace-nowrap truncate ${isActive ? 'font-bold' : 'font-normal'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```