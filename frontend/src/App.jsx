import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Dynamically target backend based on where it's deployed!
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ACCENT_COLORS = [
  { name: 'Orange', main: '#FF8C00', dark: '#E65100', light: '#FFF3E0', lighter: '#FFE0B2' },
  { name: 'Blue', main: '#3B82F6', dark: '#2563EB', light: '#EFF6FF', lighter: '#DBEAFE' },
  { name: 'Emerald', main: '#10B981', dark: '#059669', light: '#ECFDF5', lighter: '#D1FAE5' },
  { name: 'Violet', main: '#8B5CF6', dark: '#7C3AED', light: '#F5F3FF', lighter: '#EDE9FE' },
  { name: 'Rose', main: '#F43F5E', dark: '#E11D48', light: '#FFF1F2', lighter: '#FFE4E6' }
];

function App() {
  const [twinData, setTwinData] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(true);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubPassword, setGithubPassword] = useState('');
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [leetcodePassword, setLeetcodePassword] = useState('');
  const [showGithubForm, setShowGithubForm] = useState(false);
  const [showLeetcodeForm, setShowLeetcodeForm] = useState(false);
  const [journalText, setJournalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  // Profile state
  const [profileName, setProfileName] = useState('');
  const [profileUniversity, setProfileUniversity] = useState('');

  // Accent Color state
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('doppel_accent');
    return saved ? JSON.parse(saved) : ACCENT_COLORS[0];
  });

  useEffect(() => {
    localStorage.setItem('doppel_accent', JSON.stringify(accentColor));
  }, [accentColor]);

  // Syllabus state
  const [syllabi, setSyllabi] = useState([]);
  const [showSyllabusForm, setShowSyllabusForm] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState('text'); // 'text' or 'pdf'
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [syllabusContent, setSyllabusContent] = useState('');
  const [syllabusDeadline, setSyllabusDeadline] = useState('');
  const [syllabusFile, setSyllabusFile] = useState(null);
  
  // Health Data state
  const [healthFile, setHealthFile] = useState(null);

  // Schedule state
  const [generatedSchedule, setGeneratedSchedule] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleDifficulty, setScheduleDifficulty] = useState('auto');

  useEffect(() => {
    fetchState();
    fetchAccountStatus();
    fetchSyllabi();
    fetchSchedule();
    // Lightweight polling keeps account connection badges fresh in the UI.
    const interval = setInterval(fetchAccountStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAccountStatus = () => {
    axios.get('/api/account/status')
      .then(res => setAccountStatus(res.data))
      .catch(err => console.error('Failed to fetch account status:', err));
  };

  const fetchState = () => {
    axios.get('/api/twin/state')
      .then(res => {
        setTwinData(res.data);
        if (res.data?.profile) {
          setProfileName(res.data.profile.name || '');
          setProfileUniversity(res.data.profile.university || '');
        }
      })
      .catch(() => {
        setTwinData(null);
        setMessage('Unable to load twin state.');
      });
  };

  const handleApiSync = () => {
    setIsProcessing(true);
    setMessage('⏳ Syncing GitHub and LeetCode data...');
    axios.post('/api/twin/sync_apis', {}, { timeout: 15000 })
      .then(() => {
        setMessage('✓ Sync Completed! GitHub commits and LeetCode problems updated.');
        setIsProcessing(false);
        fetchState();
        setTimeout(() => setActiveTab('dashboard'), 500);
      })
      .catch((error) => {
        const errorMsg = error.response?.data?.detail || error.message || 'Error syncing APIs.';
        setMessage(`✗ Sync Failed: ${errorMsg}`);
        setIsProcessing(false);
        console.error('Sync Error:', error);
      });
  };

  const handleJournalSubmit = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('⏳ Processing journal entry...');
    axios.post('/api/twin/journal', { text: journalText }, { timeout: 10000 })
      .then(() => {
        setMessage('✓ Journal entry processed successfully!');
        setIsProcessing(false);
        setJournalText('');
        fetchState();
        setTimeout(() => setActiveTab('dashboard'), 500);
      })
      .catch((error) => {
        const errorMsg = error.response?.data?.detail || error.message || 'Error processing journal.';
        setMessage(`✗ Journal Failed: ${errorMsg}`);
        setIsProcessing(false);
        console.error('Journal Error:', error);
      });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('⏳ Updating profile...');
    try {
      await axios.post('/api/profile/update', { 
        name: profileName, 
        university: profileUniversity 
      });
      setMessage('✓ Profile updated successfully!');
      fetchState();
    } catch (error) {
      setMessage('✗ Failed to update profile.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGithubConnect = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('');

    try {
      const response = await axios.post('/api/github/connect', {
        username: githubUsername,
        password: githubPassword
      }, { timeout: 5000 });
      setMessage('✓ GitHub connected successfully! Click "Fetch" in Data Ingestion to sync commits.');
      setGithubUsername('');
      setGithubPassword('');
      setShowGithubForm(false);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Error connecting GitHub.';
      setMessage(`✗ GitHub Connect Failed: ${errorMsg}`);
      console.error('GitHub Connect Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLeetcodeConnect = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('');

    try {
      const response = await axios.post('/api/leetcode/connect', {
        username: leetcodeUsername,
        password: leetcodePassword
      }, { timeout: 5000 });
      setMessage('✓ LeetCode connected successfully! Click "Fetch" in Data Ingestion to sync problems.');
      setLeetcodeUsername('');
      setLeetcodePassword('');
      setShowLeetcodeForm(false);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Error connecting LeetCode.';
      setMessage(`✗ LeetCode Connect Failed: ${errorMsg}`);
      console.error('LeetCode Connect Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Syllabus Handlers ---
  const fetchSyllabi = () => {
    axios.get('/api/syllabus')
      .then(res => setSyllabi(res.data))
      .catch(err => console.error('Failed to fetch syllabi:', err));
  };

  const handleSyllabusTextSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('');
    try {
      await axios.post('/api/syllabus', {
        title: syllabusTitle,
        content: syllabusContent,
        deadline: syllabusDeadline,
      }, { timeout: 5000 });
      setMessage('✓ Syllabus saved successfully!');
      setSyllabusTitle('');
      setSyllabusContent('');
      setSyllabusDeadline('');
      setShowSyllabusForm(false);
      fetchSyllabi();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Error saving syllabus.';
      setMessage(`✗ Syllabus Failed: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyllabusPdfSubmit = async (e) => {
    e.preventDefault();
    if (!syllabusFile) return;
    setIsProcessing(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('title', syllabusTitle);
      formData.append('deadline', syllabusDeadline);
      formData.append('file', syllabusFile);
      await axios.post('/api/syllabus/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15000,
      });
      setMessage('✓ Syllabus PDF uploaded successfully!');
      setSyllabusTitle('');
      setSyllabusDeadline('');
      setSyllabusFile(null);
      setShowSyllabusForm(false);
      fetchSyllabi();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Error uploading PDF.';
      setMessage(`✗ Upload Failed: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHealthUpload = async (e) => {
    e.preventDefault();
    if (!healthFile) return;
    setIsProcessing(true);
    setMessage('⏳ Uploading and parsing health data...');
    try {
      const formData = new FormData();
      formData.append('file', healthFile);
      const res = await axios.post('/api/health/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15000,
      });
      setMessage(`✓ ${res.data.message}`);
      setHealthFile(null);
      fetchState();
      setTimeout(() => setActiveTab('dashboard'), 1000);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Error uploading health data.';
      setMessage(`✗ Upload Failed: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyllabusDelete = async (id) => {
    try {
      await axios.delete(`/api/syllabus/${id}`);
      setMessage('✓ Syllabus deleted.');
      fetchSyllabi();
    } catch {
      setMessage('✗ Failed to delete syllabus.');
    }
  };

  // --- Schedule Handlers ---
  const fetchSchedule = () => {
    axios.get('/api/schedule')
      .then(res => setGeneratedSchedule(res.data.schedule || []))
      .catch(err => console.error('Failed to fetch schedule:', err));
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setMessage('⏳ Generating schedule with AI... This may take 15-30 seconds.');
    
    // Update message if generation takes over 60 seconds
    const timeoutMsg = setTimeout(() => {
      setMessage('⏳ AI is processing a large syllabus! This might take a few minutes...');
    }, 60000);

    try {
      const res = await axios.post('/api/schedule/generate', { difficulty: scheduleDifficulty }, { timeout: 300000 });
      setMessage(`✓ ${res.data.message}`);
      fetchSchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      setMessage(`✗ Schedule generation failed: ${errorMsg}`);
    } finally {
      clearTimeout(timeoutMsg);
      setIsGenerating(false);
    }
  };

  const handleToggleTask = async (taskId) => {
    try {
      await axios.patch(`/api/schedule/task/${taskId}/toggle`);
      fetchSchedule();
    } catch {
      setMessage('✗ Failed to toggle task.');
    }
  };

  const handleVerifyTasks = async () => {
    setIsProcessing(true);
    setMessage(' Verifying tasks via LeetCode & GitHub APIs...');
    try {
      const res = await axios.post('/api/schedule/verify', {}, { timeout: 30000 });
      setMessage(`✓ ${res.data.message}`);
      fetchSchedule();
    } catch {
      setMessage('✗ Verification failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjustSchedule = async () => {
    setIsGenerating(true);
    setMessage('⏳ Adjusting schedule for missed tasks...');

    const timeoutMsg = setTimeout(() => {
      setMessage('⏳ AI is adjusting a complex schedule! This might take a few minutes...');
    }, 60000);

    try {
      const res = await axios.post('/api/schedule/adjust', { difficulty: scheduleDifficulty }, { timeout: 300000 });
      setMessage(`✓ ${res.data.message}`);
      fetchSchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      setMessage(`✗ Adjustment failed: ${errorMsg}`);
    } finally {
      clearTimeout(timeoutMsg);
      setIsGenerating(false);
    }
  };

  if (!twinData) return (
    <div 
      className={`flex items-center justify-center min-h-screen transition-colors duration-500 ${
        darkMode ? 'bg-linear-to-br from-slate-900 via-slate-800 to-black' : 'bg-white'
      }`}
      style={{
        '--color-primary-50': accentColor.light,
        '--color-primary-100': accentColor.lighter,
        '--color-primary-500': accentColor.main,
        '--color-primary-600': accentColor.dark,
      }}
    >
      <div className="text-center space-y-4">
        <div className="text-6xl animate-bounce">⚙️</div>
        <div className={`text-3xl font-bold bg-linear-to-r ${
          darkMode ? 'from-blue-400 via-purple-400 to-pink-400' : 'from-blue-600 via-purple-600 to-pink-600'
        } bg-clip-text text-transparent animate-pulse`}>
          Initializing Agent Environment
        </div>
        <div className="h-1 w-32 mx-auto bg-linear-to-r from-blue-500 to-purple-500 rounded-full animate-pulse mt-4"></div>
      </div>
    </div>
  );

  return (
    <div 
      className={`flex h-screen overflow-hidden transition-colors duration-300 ${
        darkMode ? 'bg-[var(--color-surface-dark)] text-slate-100' : 'bg-[var(--color-surface-light)] text-slate-900'
      }`}
      style={{
        '--color-primary-50': accentColor.light,
        '--color-primary-100': accentColor.lighter,
        '--color-primary-500': accentColor.main,
        '--color-primary-600': accentColor.dark,
      }}
    >
      
      {/* MODERN SIDEBAR */}
      <div className={`w-72 flex flex-col z-10 transition-colors duration-300 ${
        darkMode 
          ? 'bg-[#121212] border-r border-slate-800' 
          : 'bg-white border-r border-slate-200'
      }`}>
        
        {/* Logo Section */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-[var(--color-primary-500)] tracking-tight">
              DOPPEL
            </h2>
          </div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            v1.0 
          </p>
        </div>

        {/* Navigation - UPDATED TAB NAME HERE */}
        <div className="flex-1 px-4 py-6 space-y-3">
          {['dashboard', 'timeline_&_schedule', 'data_ingestion', 'tracking', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-5 py-3 rounded-full capitalize font-medium transition-all duration-200 group relative overflow-hidden ${
                activeTab === tab 
                  ? 'bg-[var(--color-primary-500)] text-white shadow-sm'
                  : darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>{tab.replace(/_/g, ' ')}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Profile Card */}
        <div className={`m-4 p-5 rounded-2xl transition-all duration-300 ${
          darkMode
            ? 'bg-slate-800 border border-slate-700'
            : 'bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Active Profile</p>
          <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{twinData.profile.name}</p>
          <p className="text-xs text-slate-400 mt-1">{twinData.profile.university}</p>
        </div>

        {/* Dark Mode Toggle */}
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 mb-2 ${
              darkMode
                ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Header */}
        <header className={`sticky top-0 z-20 px-10 py-6 transition-colors duration-300 ${
          darkMode ? 'bg-[var(--color-surface-dark)]/90 backdrop-blur-sm border-b border-slate-800' : 'bg-[var(--color-surface-light)]/90 backdrop-blur-sm border-b border-slate-200'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-4xl font-bold tracking-tight capitalize ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}>
                {activeTab.replace(/_/g, ' ')}
              </h1>
            </div>
            {twinData.agent_status.needs_intervention ? (
              <div className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-3 border transition-all duration-300 animate-pulse shadow-lg ${
                darkMode
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-red-100/80 text-red-700 border-red-300'
              }`}>
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                Agent Override Active
              </div>
            ) : (
              <div className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-3 border transition-all duration-300 ${
                darkMode
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-green-100 text-green-700 border-green-300'
              }`}>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                System Nominal
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="p-10">
          {message && (
            <div className={`mb-6 rounded-3xl border p-5 ${
              darkMode ? 'bg-slate-800/60 border-slate-700 text-slate-100' : 'bg-slate-100 border-slate-200 text-slate-900'
            }`}>
              {message}
            </div>
          )}
          {/* --- DASHBOARD VIEW (Unchanged) --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  { label: 'Commit Streak', value: `${accountStatus?.metrics?.coding_streak_days ?? twinData.metrics.coding_streak_days} days`, icon: '', textColor: 'text-orange-500' },
                  { label: 'LeetCode Streak', value: `${accountStatus?.metrics?.leetcode_streak_days ?? twinData.metrics.leetcode_streak_days ?? 0} days`, icon: '', textColor: 'text-yellow-500' },
                  { label: 'Focus Score', value: twinData.metrics.focus_score, icon: '', textColor: 'text-[var(--color-primary-500)]' },
                  { label: 'Stress Index', value: `${twinData.metrics.current_stress_score.toFixed(1)}/10`, icon: '', textColor: twinData.metrics.current_stress_score > 7 ? 'text-red-500' : 'text-emerald-500' },
                  { label: 'Sleep Status', value: twinData.metrics.sleep_deficit_hours < 7 ? `${twinData.metrics.sleep_deficit_hours} hrs (Sleep Deficit)` : twinData.metrics.sleep_deficit_hours > 9 ? `${twinData.metrics.sleep_deficit_hours} hrs (Overslept)` : `${twinData.metrics.sleep_deficit_hours} hrs (Sufficient Sleep)`, icon: '', textColor: 'text-indigo-500' },
                ].map((metric, i) => (
                  <div
                    key={i}
                    className={`p-6 rounded-2xl border transition-all duration-200 elevation-1 group card-hover ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700/80'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {metric.label}
                      </h3>
                    <span className="text-2xl group-hover:scale-110 transition-transform"></span>
                    </div>
                    <p className={`text-3xl font-bold ${metric.textColor}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Agent Analysis Card */}
                <div className={`lg:col-span-2 p-8 rounded-2xl border transition-all duration-300 elevation-1 ${
                  twinData.agent_status.needs_intervention
                    ? darkMode
                      ? 'bg-indigo-900/30 border-indigo-500/50'
                      : 'bg-indigo-50 border-indigo-200'
                    : darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <h2 className={`text-xl font-bold mb-6 flex items-center gap-3 ${
                    twinData.agent_status.needs_intervention
                      ? darkMode ? 'text-indigo-300' : 'text-indigo-800'
                      : darkMode ? 'text-slate-100' : 'text-slate-800'
                  }`}>
                    Agent Analysis
                  </h2>
                  <p className={`text-lg leading-relaxed mb-6 ${
                    twinData.agent_status.needs_intervention
                      ? darkMode ? 'text-indigo-200' : 'text-indigo-900'
                      : darkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {twinData.agent_status.agent_message}
                  </p>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>Recent Actions</h3>
                    <div className="space-y-3">
                      {twinData.agent_status.history.slice(0, 3).map((hist, i) => (
                        <div
                          key={i}
                          className={`p-4 rounded-xl transition-all duration-300 border ${
                            twinData.agent_status.needs_intervention
                              ? darkMode
                                ? 'bg-indigo-900/20 border-indigo-500/20 text-indigo-300'
                                : 'bg-indigo-100/50 border-indigo-200 text-indigo-800'
                              : darkMode
                              ? 'bg-slate-700/50 border-slate-600/50 text-slate-300'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-75">{hist.time}</span>
                          <p className="text-sm font-medium mt-1">{hist.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Goals Card */}
                <div className={`p-8 rounded-2xl border transition-all duration-300 elevation-1 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <h2 className={`text-xl font-bold mb-8 flex items-center gap-3 ${
                    darkMode ? 'text-slate-100' : 'text-slate-800'
                  }`}>
                    Goals
                  </h2>
                  <div className="space-y-8">
                    {twinData.goals.map((goal, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-3">
                          <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            {goal.name}
                          </span>
                          <span className={`text-sm font-bold text-[var(--color-primary-500)]`}>
                            {goal.progress}%
                          </span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${
                          darkMode ? 'bg-slate-700' : 'bg-slate-100'
                        }`}>
                          <div
                            className="h-full rounded-full bg-[var(--color-primary-500)] transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* --- SCHEDULE VIEW — AI Generated --- */}
          {activeTab === 'timeline_&_schedule' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  className="px-6 py-3 rounded-full font-bold text-white transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                >
                  {isGenerating ? ' Generating...' : ' Generate Schedule with AI'}
                </button>
                <button
                  onClick={handleVerifyTasks}
                  disabled={isProcessing}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105 ${
                    darkMode
                      ? 'bg-slate-700/50 text-slate-200 hover:bg-slate-600/50'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  } disabled:opacity-50`}
                >
                   Verify Tasks
                </button>
                <button
                  onClick={handleAdjustSchedule}
                  disabled={isGenerating}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105 ${
                    darkMode
                      ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  } disabled:opacity-50`}
                >
                   Adjust for Missed Tasks
                </button>
              </div>

              {/* Difficulty Selector */}
              <div className={`rounded-2xl border p-6 transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>Schedule Difficulty</h3>
                    <p className={`text-xs mt-1 ${
                      darkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {scheduleDifficulty === 'auto' && 'The AI decides based on your stress, sleep & focus levels'}
                      {scheduleDifficulty === 'easy' && 'Lighter workload with generous breaks & easy problems'}
                      {scheduleDifficulty === 'medium' && 'Balanced workload with moderate study sessions'}
                      {scheduleDifficulty === 'hard' && 'Intensive schedule with deep study blocks & hard problems'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: 'auto', label: ' Auto', activeClass: 'bg-[var(--color-primary-500)] text-white elevation-2' },
                    { value: 'easy', label: ' Easy', activeClass: 'bg-green-500 text-white elevation-2' },
                    { value: 'medium', label: ' Medium', activeClass: 'bg-orange-500 text-white elevation-2' },
                    { value: 'hard', label: ' Hard', activeClass: 'bg-red-500 text-white elevation-2' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setScheduleDifficulty(opt.value)}
                      className={`py-3 px-4 rounded-full font-semibold text-sm transition-all duration-200 ${
                        scheduleDifficulty === opt.value
                          ? opt.activeClass
                          : darkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule Content */}
              {generatedSchedule.length === 0 ? (
                <div className={`rounded-3xl border p-12 text-center ${
                  darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
                }`}>
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    No Schedule Generated Yet
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Add a syllabus in Settings, then click "Generate Schedule with AI" to create your personalized study plan.
                  </p>
                </div>
              ) : (
                generatedSchedule.map(dayGroup => {
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = dayGroup.date === today;
                  const isPast = dayGroup.date < today;
                  const dateObj = new Date(dayGroup.date + 'T00:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const completedCount = dayGroup.tasks.filter(t => t.status === 'completed' || t.status === 'auto_verified').length;
                  const totalCount = dayGroup.tasks.length;

                  return (
                    <div key={dayGroup.date} className={`rounded-2xl border transition-all duration-300 overflow-hidden elevation-1 ${
                      isToday
                        ? darkMode
                          ? 'bg-slate-800 border-[var(--color-primary-500)]'
                          : 'bg-white border-[var(--color-primary-500)]'
                        : isPast
                        ? darkMode
                          ? 'bg-slate-800/40 border-slate-700/40 opacity-75'
                          : 'bg-slate-50 border-slate-200 opacity-75'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-white border-slate-200'
                    }`}>
                      <div className={`px-8 py-5 flex items-center justify-between border-b ${
                        isToday
                          ? darkMode ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10' : 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]'
                          : darkMode ? 'border-slate-700' : 'border-slate-100'
                      }`}>
                        <div className="flex items-center gap-3">
                          {isToday && <span className="w-3 h-3 rounded-full bg-[var(--color-primary-500)] animate-pulse"></span>}
                          <div>
                            <h3 className={`text-lg font-bold ${
                              isToday
                                ? 'text-[var(--color-primary-600)]'
                                : darkMode ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {isToday ? '📌 TODAY' : dayName}
                            </h3>
                            <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {dateDisplay}
                            </p>
                          </div>
                        </div>
                        <div className={`text-sm font-bold px-4 py-1 rounded-full ${
                          completedCount === totalCount && totalCount > 0
                            ? darkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                            : darkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {completedCount}/{totalCount} done
                        </div>
                      </div>

                      {/* Tasks */}
                      <div className="px-6 pb-6 space-y-2">
                        {dayGroup.tasks.map(task => {
                          const isCompleted = task.status === 'completed' || task.status === 'auto_verified';
                          const isMissed = task.status === 'missed';
                          const isAutoVerified = task.status === 'auto_verified';
                          const isLeetcode = task.verification_type === 'leetcode';

                          const typeBadgeColors = {
                            'LeetCode': darkMode ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-800',
                            'GitHub': darkMode ? 'bg-slate-600/50 text-slate-300' : 'bg-slate-200 text-slate-700',
                            'Academic': darkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
                            'Well-being': darkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700',
                            'Coding': darkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700',
                            'Project': darkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700',
                          };

                          return (
                            <div
                              key={task.id}
                              onClick={() => !isAutoVerified && handleToggleTask(task.id)}
                              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                                isAutoVerified
                                  ? darkMode
                                    ? 'bg-green-900/40 border-green-700'
                                    : 'bg-green-50 border-green-300'
                                  : isCompleted
                                  ? darkMode
                                    ? 'bg-green-900/20 border-green-800 opacity-80'
                                    : 'bg-green-50/50 border-green-200 opacity-80'
                                  : isMissed
                                  ? darkMode
                                    ? 'bg-red-900/30 border-red-800/80'
                                    : 'bg-red-50 border-red-200'
                                  : darkMode
                                  ? 'bg-slate-700 border-slate-600 cursor-pointer hover:bg-slate-600'
                                  : 'bg-white border-slate-200 cursor-pointer hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                isAutoVerified
                                  ? 'bg-green-500 border-green-500'
                                  : isCompleted
                                  ? 'bg-[var(--color-primary-500)] border-[var(--color-primary-500)]'
                                  : isMissed
                                  ? 'bg-red-500/30 border-red-500'
                                  : darkMode
                                  ? 'border-slate-500'
                                  : 'border-slate-300'
                              }`}>
                                {isAutoVerified && <span className="text-white text-xs">🤖</span>}
                                {isCompleted && !isAutoVerified && <span className="text-white text-xs">✓</span>}
                                {isMissed && <span className="text-white text-xs">✗</span>}
                              </div>

                              {/* Time */}
                              <div className={`w-24 font-mono text-xs font-bold shrink-0 ${
                                darkMode ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {task.time}
                              </div>

                              {/* Task Description */}
                              <div className={`flex-1 min-w-0 ${
                                isCompleted || isAutoVerified
                                  ? `line-through ${darkMode ? 'text-slate-500' : 'text-slate-400'}`
                                  : isMissed
                                  ? darkMode ? 'text-red-300' : 'text-red-600'
                                  : darkMode ? 'text-slate-100' : 'text-slate-800'
                              }`}>
                                <span className="text-sm font-semibold">{task.task}</span>
                                {task.verification_data && (
                                  <span className={`block text-xs mt-0.5 ${
                                    darkMode ? 'text-slate-500' : 'text-slate-400'
                                  }`}>
                                    {isLeetcode ? '💡' : '📂'} {task.verification_data}
                                  </span>
                                )}
                              </div>

                              {/* Type Badge */}
                              <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${
                                typeBadgeColors[task.type] || (darkMode ? 'bg-slate-600/50 text-slate-300' : 'bg-slate-200 text-slate-700')
                              }`}>
                                {task.type}
                              </span>

                              {/* Status Badge */}
                              <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${
                                isAutoVerified
                                  ? darkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                                  : isCompleted
                                  ? darkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                                  : isMissed
                                  ? darkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                  : darkMode ? 'bg-slate-600/30 text-slate-400' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {isAutoVerified ? '🤖 Verified'
                                  : isCompleted ? '✓ Done'
                                  : isMissed ? '✗ Missed'
                                  : 'Pending'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* --- NEW DATA INGESTION VIEW (Styled perfectly to your theme) --- */}
          {activeTab === 'data_ingestion' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Method 1: API Sync */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <h2 className={`text-2xl font-bold mb-3 flex items-center gap-3 ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}>
                  Digital Exhaust Sync
                </h2>
                <p className={`mb-8 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Simulate background polling of external services (GitHub/LeetCode) to track academic metrics autonomously.
                </p>
                
                <div className="space-y-4 mb-8">
                  <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${darkMode ? 'bg-slate-700/30 border-slate-600/50' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-3xl"></div>
                    <div>
                      <h4 className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>GitHub</h4>
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tracking daily commits</p>
                    </div>
                    <div className="ml-auto text-green-500 text-sm font-bold animate-pulse">Connected</div>
                  </div>
                  <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${darkMode ? 'bg-slate-700/30 border-slate-600/50' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-3xl"></div>
                    <div>
                      <h4 className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>LeetCode</h4>
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tracking problem streaks</p>
                    </div>
                    <div className="ml-auto text-green-500 text-sm font-bold animate-pulse">Connected</div>
                  </div>
                </div>

                <button 
                  onClick={handleApiSync}
                  disabled={isProcessing}
                  className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                >
                  {isProcessing ? 'Fetching APIs...' : ' Fetch'}
                </button>
              </div>

              {/* Method 2: NLP Journal */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <h2 className={`text-2xl font-bold mb-3 flex items-center gap-3 ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}>
                  NLP Daily Check-in
                </h2>
                <p className={`mb-8 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Simulate extracting subjective metrics (sleep, stress, focus) from natural language using AI entity extraction.
                </p>
                
                <form onSubmit={handleJournalSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <label className={`block text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      How was your day?
                    </label>
                    <textarea 
                      rows="4"
                      className={`w-full px-5 py-4 rounded-xl font-semibold transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border resize-none ${
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                          : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                      }`}
                      placeholder="e.g., I finally slept 8 hours, and finished my leetcode practice."
                      value={journalText}
                      onChange={e => setJournalText(e.target.value)}
                    ></textarea>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isProcessing || !journalText}
                    className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                  >
                    {isProcessing ? ' Extracting Entities...' : ' Analyze & Update Twin'}
                  </button>
                </form>
              </div>

              {/* Method 3: Health Data Export */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10 flex flex-col`}>
                <h2 className={`text-2xl font-bold mb-3 flex items-center gap-3 ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}>
                  Health Data Export
                </h2>
                <p className={`mb-8 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Upload a raw .csv or .json data export from Apple Health or Google Fit to precisely track sleep and activity metrics.
                </p>
                
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 ${
                    darkMode ? 'border-slate-600' : 'border-slate-300'
                  }`}>
                    <label className="cursor-pointer w-full h-full block">
                      <div className="text-4xl mb-3"></div>
                      <span className={`block font-bold mb-1 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {healthFile ? healthFile.name : 'Select or drop export file'}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Supports .csv, .json (Max 10MB)
                      </span>
                      <input 
                        type="file" 
                        accept=".csv,.json"
                        className="hidden"
                        onChange={e => setHealthFile(e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleHealthUpload}
                    disabled={isProcessing || !healthFile}
                    className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                  >
                    {isProcessing ? ' Uploading...' : ' Sync Health Data'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- TRACKING VIEW --- */}
          {activeTab === 'tracking' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* GitHub Status */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <h2 className={`text-2xl font-bold mb-3 ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}>
                  GitHub Status
                </h2>
                {accountStatus?.github?.connected ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${
                      darkMode ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-300'
                    }`}>
                      <p className={`text-sm font-bold ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                        ✓ Connected
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Account
                        </p>
                        <p className={`text-lg font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {accountStatus.github.username || accountStatus.github.email}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Commits Streak
                        </p>
                        <p className="text-3xl font-bold text-[var(--color-primary-500)]">
                          {accountStatus.metrics?.coding_streak_days || 0} days
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Last Sync
                        </p>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {accountStatus.github.last_sync 
                            ? new Date(accountStatus.github.last_sync).toLocaleString() 
                            : 'Never synced'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl border ${
                    darkMode ? 'bg-slate-700/30 border-slate-600/50' : 'bg-slate-100 border-slate-300'
                  }`}>
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      No GitHub account connected. Go to Settings → Link GitHub to connect.
                    </p>
                  </div>
                )}
              </div>

              {/* LeetCode Status */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <h2 className={`text-2xl font-bold mb-3 ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}>
                  LeetCode Status
                </h2>
                {accountStatus?.leetcode?.connected ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${
                      darkMode ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-300'
                    }`}>
                      <p className={`text-sm font-bold ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                        ✓ Connected
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Account
                        </p>
                        <p className={`text-lg font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {accountStatus.leetcode.username || accountStatus.leetcode.email}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Problem Solving Streak
                        </p>
                        <p className="text-3xl font-bold text-[var(--color-primary-500)]">
                          Active
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs uppercase tracking-wider font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Last Sync
                        </p>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {accountStatus.leetcode.last_sync 
                            ? new Date(accountStatus.leetcode.last_sync).toLocaleString() 
                            : 'Never synced'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl border ${
                    darkMode ? 'bg-slate-700/30 border-slate-600/50' : 'bg-slate-100 border-slate-300'
                  }`}>
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      No LeetCode account connected. Go to Settings → Link LeetCode to connect.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- SETTINGS VIEW --- */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Profile Settings */}
              <div className={`col-span-1 lg:col-span-2 rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      Profile Information
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Update your display name and institution.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    type="text"
                    placeholder="Full Name"
                    className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                      darkMode
                        ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                        : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                    }`}
                    required
                  />
                  <input
                    value={profileUniversity}
                    onChange={(e) => setProfileUniversity(e.target.value)}
                    type="text"
                    placeholder="Institution / Company"
                    className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                      darkMode
                        ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                        : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                    }`}
                    required
                  />
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full sm:w-auto py-3 px-8 rounded-full font-bold text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                    >
                      {isProcessing ? 'Updating...' : 'Update Profile'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Appearance Settings */}
              <div className={`col-span-1 lg:col-span-2 rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      Appearance
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Customize the accent color of your workspace.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {ACCENT_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => setAccentColor(color)}
                      className={`w-12 h-12 rounded-full elevation-2 transition-transform hover:scale-110 ${
                        accentColor.name === color.name ? (darkMode ? 'ring-4 ring-white border-2 border-slate-800' : 'ring-4 ring-slate-800 border-2 border-white') : ''
                      }`}
                      style={{ backgroundColor: color.main }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* GitHub Connection */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      GitHub
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Track daily commits and sync your GitHub streak.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGithubForm(!showGithubForm)}
                    className="px-4 py-2 rounded-full bg-[var(--color-primary-500)] text-white font-semibold hover:bg-[var(--color-primary-600)]"
                  >
                    {showGithubForm ? 'Hide Link' : 'Link GitHub'}
                  </button>
                </div>
                {showGithubForm && (
                  <form onSubmit={handleGithubConnect} className="space-y-4">
                    <input
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      type="text"
                      placeholder="GitHub Username"
                      className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                          : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                      }`}
                      required
                    />
                    <input
                      value={githubPassword}
                      onChange={(e) => setGithubPassword(e.target.value)}
                      type="password"
                      placeholder="Personal Access Token (PAT)"
                      className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                          : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                      }`}
                      required
                    />
                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic). No special scopes needed for public repos.
                    </p>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                    >
                      {isProcessing ? 'Linking GitHub...' : 'Link GitHub'}
                    </button>
                  </form>
                )}
              </div>

              {/* LeetCode Connection */}
              <div className={`rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      LeetCode
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Track daily solved questions and streaks.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeetcodeForm(!showLeetcodeForm)}
                    className="px-4 py-2 rounded-full bg-[var(--color-primary-500)] text-white font-semibold hover:bg-[var(--color-primary-600)]"
                  >
                    {showLeetcodeForm ? 'Hide Link' : 'Link LeetCode'}
                  </button>
                </div>
                {showLeetcodeForm && (
                  <form onSubmit={handleLeetcodeConnect} className="space-y-4">
                    <input
                      value={leetcodeUsername}
                      onChange={(e) => setLeetcodeUsername(e.target.value)}
                      type="text"
                      placeholder="LeetCode Username"
                      className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                          : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                      }`}
                      required
                    />
                    <input
                      value={leetcodePassword}
                      onChange={(e) => setLeetcodePassword(e.target.value)}
                      type="password"
                      placeholder="LeetCode Password"
                      className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                        darkMode
                          ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                          : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                      }`}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                    >
                      {isProcessing ? 'Linking LeetCode...' : 'Link LeetCode'}
                    </button>
                  </form>
                )}
              </div>
              {/* Syllabus Management — Full Width */}
              <div className={`col-span-1 lg:col-span-2 rounded-2xl border transition-all duration-300 elevation-1 ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              } p-10`}>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      Syllabus
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Add your course syllabus and set a completion deadline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSyllabusForm(!showSyllabusForm)}
                    className="px-4 py-2 rounded-full bg-[var(--color-primary-500)] text-white font-semibold hover:bg-[var(--color-primary-600)] transition-colors"
                  >
                    {showSyllabusForm ? 'Hide Form' : '+ Add Syllabus'}
                  </button>
                </div>

                {showSyllabusForm && (
                  <div className="mb-8">
                    {/* Mode Toggle */}
                    <div className="flex gap-2 mb-6">
                      <button
                        type="button"
                        onClick={() => setSyllabusMode('text')}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                          syllabusMode === 'text'
                            ? 'bg-[var(--color-primary-500)] text-white elevation-1'
                            : darkMode
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        Text Input
                      </button>
                      <button
                        type="button"
                        onClick={() => setSyllabusMode('pdf')}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                          syllabusMode === 'pdf'
                            ? 'bg-[var(--color-primary-500)] text-white elevation-1'
                            : darkMode
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        PDF Upload
                      </button>
                    </div>

                    <form
                      onSubmit={syllabusMode === 'text' ? handleSyllabusTextSubmit : handleSyllabusPdfSubmit}
                      className="space-y-4"
                    >
                      {/* Title */}
                      <input
                        value={syllabusTitle}
                        onChange={(e) => setSyllabusTitle(e.target.value)}
                        type="text"
                        placeholder="Course / Subject Title"
                        className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                          darkMode
                            ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                            : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                        }`}
                        required
                      />

                      {/* Deadline */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>Completion Deadline</label>
                        <input
                          value={syllabusDeadline}
                          onChange={(e) => setSyllabusDeadline(e.target.value)}
                          type="date"
                          className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                            darkMode
                              ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500 [color-scheme:dark]'
                              : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                          }`}
                          required
                        />
                      </div>

                      {/* Content: Text or PDF */}
                      {syllabusMode === 'text' ? (
                        <textarea
                          rows="6"
                          value={syllabusContent}
                          onChange={(e) => setSyllabusContent(e.target.value)}
                          placeholder="Paste your syllabus content here...  (topics, chapters, units, etc.)"
                          className={`w-full px-4 py-3 rounded-xl transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border resize-none ${
                            darkMode
                              ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                              : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                          }`}
                          required
                        />
                      ) : (
                        <div className={`p-6 rounded-xl border-2 border-dashed text-center transition-all duration-300 ${
                          darkMode
                            ? 'border-slate-600 bg-slate-700/30 hover:border-purple-500/50'
                            : 'border-slate-300 bg-slate-50 hover:border-purple-400'
                        }`}>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setSyllabusFile(e.target.files[0])}
                            className="hidden"
                            id="syllabus-pdf-input"
                            required
                          />
                          <label htmlFor="syllabus-pdf-input" className="cursor-pointer">
                            <div className="text-4xl mb-2">📄</div>
                            <p className={`text-sm font-semibold ${
                              darkMode ? 'text-slate-300' : 'text-slate-600'
                            }`}>
                              {syllabusFile ? syllabusFile.name : 'Click to select a PDF file'}
                            </p>
                            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              PDF files only
                            </p>
                          </label>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-4 px-6 rounded-full font-bold text-lg text-white uppercase tracking-wider transition-all duration-200 elevation-2 hover:bg-[var(--color-primary-600)] bg-[var(--color-primary-500)] disabled:opacity-50"
                      >
                        {isProcessing ? 'Saving...' : syllabusMode === 'text' ? 'Save Syllabus' : 'Upload PDF'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Saved Syllabi List */}
                {syllabi.length > 0 && (
                  <div className="space-y-3">
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>Saved Syllabi</h3>
                    {syllabi.map(s => {
                      const deadlineDate = s.deadline ? new Date(s.deadline) : null;
                      const now = new Date();
                      const daysLeft = deadlineDate ? Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24)) : null;
                      const isOverdue = daysLeft !== null && daysLeft < 0;
                      const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

                      return (
                        <div
                          key={s.id}
                          className={`p-5 rounded-xl border transition-all duration-300 flex items-center gap-4 ${
                            isOverdue
                              ? darkMode
                                ? 'bg-red-900/20 border-red-500/30'
                                : 'bg-red-50 border-red-300'
                              : isUrgent
                              ? darkMode
                                ? 'bg-slate-800 border-[var(--color-primary-600)] shadow-[0_0_10px_var(--color-primary-600)] shadow-opacity-20'
                                : 'bg-[var(--color-primary-50)] border-[var(--color-primary-500)]'
                              : darkMode
                              ? 'bg-slate-700/30 border-slate-600/50 hover:border-slate-500'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`font-bold truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                {s.title}
                              </h4>
                              {s.has_pdf && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  darkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                }`}>PDF</span>
                              )}
                            </div>
                            {s.content && (
                              <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {s.content}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`text-xs font-semibold ${
                                isOverdue
                                  ? 'text-red-500'
                                  : isUrgent
                                  ? 'text-[var(--color-primary-600)] font-bold'
                                  : darkMode ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                📅 {deadlineDate ? deadlineDate.toLocaleDateString() : 'No deadline'}
                                {daysLeft !== null && (
                                  isOverdue
                                    ? ` (${Math.abs(daysLeft)} days overdue)`
                                    : daysLeft === 0
                                    ? ' (Due today!)'
                                    : ` (${daysLeft} days left)`
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.has_pdf && (
                              <a
                                href={`${axios.defaults.baseURL}/api/syllabus/${s.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
                                  darkMode
                                    ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                Download
                              </a>
                            )}
                            <button
                              onClick={() => handleSyllabusDelete(s.id)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
                                darkMode
                                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
