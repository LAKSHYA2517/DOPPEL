import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

  // Syllabus state
  const [syllabi, setSyllabi] = useState([]);
  const [showSyllabusForm, setShowSyllabusForm] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState('text'); // 'text' or 'pdf'
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [syllabusContent, setSyllabusContent] = useState('');
  const [syllabusDeadline, setSyllabusDeadline] = useState('');
  const [syllabusFile, setSyllabusFile] = useState(null);

  // Schedule state
  const [generatedSchedule, setGeneratedSchedule] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchState();
    fetchAccountStatus();
    fetchSyllabi();
    fetchSchedule();
    const interval = setInterval(fetchAccountStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAccountStatus = () => {
    axios.get('http://localhost:8000/api/account/status')
      .then(res => setAccountStatus(res.data))
      .catch(err => console.error('Failed to fetch account status:', err));
  };

  const fetchState = () => {
    axios.get('http://localhost:8000/api/twin/state')
      .then(res => setTwinData(res.data))
      .catch(() => {
        setTwinData(null);
        setMessage('Unable to load twin state.');
      });
  };

  const handleApiSync = () => {
    setIsProcessing(true);
    setMessage('⏳ Syncing GitHub and LeetCode data...');
    axios.post('http://localhost:8000/api/twin/sync_apis', {}, { timeout: 15000 })
      .then(() => {
        setMessage('✓ Sync Completed! GitHub commits and LeetCode problems updated.');
        setIsProcessing(false);
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
    axios.post('http://localhost:8000/api/twin/journal', { text: journalText }, { timeout: 10000 })
      .then(() => {
        setMessage('✓ Journal entry processed successfully!');
        setIsProcessing(false);
        setJournalText('');
        setTimeout(() => setActiveTab('dashboard'), 500);
      })
      .catch((error) => {
        const errorMsg = error.response?.data?.detail || error.message || 'Error processing journal.';
        setMessage(`✗ Journal Failed: ${errorMsg}`);
        setIsProcessing(false);
        console.error('Journal Error:', error);
      });
  };

  const handleGithubConnect = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('');

    try {
      const response = await axios.post('http://localhost:8000/api/github/connect', {
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
      const response = await axios.post('http://localhost:8000/api/leetcode/connect', {
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
    axios.get('http://localhost:8000/api/syllabus')
      .then(res => setSyllabi(res.data))
      .catch(err => console.error('Failed to fetch syllabi:', err));
  };

  const handleSyllabusTextSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage('');
    try {
      await axios.post('http://localhost:8000/api/syllabus', {
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
      await axios.post('http://localhost:8000/api/syllabus/upload', formData, {
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

  const handleSyllabusDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/api/syllabus/${id}`);
      setMessage('✓ Syllabus deleted.');
      fetchSyllabi();
    } catch {
      setMessage('✗ Failed to delete syllabus.');
    }
  };

  // --- Schedule Handlers ---
  const fetchSchedule = () => {
    axios.get('http://localhost:8000/api/schedule')
      .then(res => setGeneratedSchedule(res.data.schedule || []))
      .catch(err => console.error('Failed to fetch schedule:', err));
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setMessage('⏳ Generating schedule with AI... This may take 15-30 seconds.');
    try {
      const res = await axios.post('http://localhost:8000/api/schedule/generate', {}, { timeout: 60000 });
      setMessage(`✓ ${res.data.message}`);
      fetchSchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      setMessage(`✗ Schedule generation failed: ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleTask = async (taskId) => {
    try {
      await axios.patch(`http://localhost:8000/api/schedule/task/${taskId}/toggle`);
      fetchSchedule();
    } catch {
      setMessage('✗ Failed to toggle task.');
    }
  };

  const handleVerifyTasks = async () => {
    setIsProcessing(true);
    setMessage('⏳ Verifying tasks via LeetCode & GitHub APIs...');
    try {
      const res = await axios.post('http://localhost:8000/api/schedule/verify', {}, { timeout: 30000 });
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
    try {
      const res = await axios.post('http://localhost:8000/api/schedule/adjust', {}, { timeout: 60000 });
      setMessage(`✓ ${res.data.message}`);
      fetchSchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      setMessage(`✗ Adjustment failed: ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!twinData) return (
    <div className={`flex items-center justify-center min-h-screen transition-colors duration-500 ${
      darkMode ? 'bg-linear-to-br from-slate-900 via-slate-800 to-black' : 'bg-white'
    }`}>
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
    <div className={`flex min-h-screen transition-colors duration-500 ${
      darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
    } font-sans`}>
      
      {/* MODERN SIDEBAR */}
      <div className={`w-72 flex flex-col shadow-2xl z-10 transition-colors duration-300 ${
        darkMode 
          ? 'bg-linear-to-b from-slate-800 via-slate-900 to-black border-r border-slate-700' 
          : 'bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-300'
      }`}>
        
        {/* Logo Section */}
        <div className="p-8 border-b border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-purple-500 rounded-lg blur opacity-75 animate-pulse"></div>
            </div>
            <h2 className="text-2xl font-black bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              TwinAgent
            </h2>
          </div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            v1.0 • Review Build
          </p>
        </div>

        {/* Navigation - UPDATED TAB NAME HERE */}
        <div className="flex-1 px-4 py-6 space-y-3">
          {['dashboard', 'timeline_&_schedule', 'data_ingestion', 'tracking', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-5 py-4 rounded-xl capitalize font-bold transition-all duration-300 group relative overflow-hidden ${
                activeTab === tab 
                  ? 'bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-blue-500/30'
                  : `${darkMode ? 'hover:bg-slate-700/50' : ''} text-slate-300 hover:text-white hover:bg-slate-700/30`
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>{tab.replace(/_/g, ' ')}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Profile Card */}
        <div className={`m-4 p-5 rounded-2xl backdrop-blur-md transition-all duration-300 ${
          darkMode
            ? 'bg-slate-700/30 border border-slate-600/50 hover:border-slate-500/50'
            : 'bg-slate-700/20 border border-slate-600/30'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Active Profile</p>
          <p className="text-lg font-bold text-white">{twinData.profile.name}</p>
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
        <header className={`sticky top-0 z-20 p-8 backdrop-blur-md transition-colors duration-300 ${
          darkMode
            ? 'bg-slate-800/50 border-b border-slate-700/30'
            : 'bg-white border-b border-slate-200'
        }`}>
          <div className={`flex justify-between items-center border-b ${darkMode ? 'border-slate-700/30' : 'border-slate-200/50'}`}>
            <div>
              <h1 className={`text-5xl font-black tracking-tight bg-linear-to-r ${
                darkMode
                  ? 'from-blue-400 via-purple-400 to-pink-400'
                  : 'from-slate-900 via-blue-600 to-purple-600'
              } bg-clip-text text-transparent capitalize`}>
                {activeTab.replace(/_/g, ' ')}
              </h1>
              <div className="h-1 w-20 bg-linear-to-r from-blue-500 to-purple-500 rounded-full mt-2"></div>
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
                  { label: 'Commit Streak', value: `${accountStatus?.metrics?.coding_streak_days ?? twinData.metrics.coding_streak_days} days`, icon: '', color: 'from-orange-500 to-red-500' },
                  { label: 'LeetCode Streak', value: `${accountStatus?.metrics?.leetcode_streak_days ?? twinData.metrics.leetcode_streak_days ?? 0} days`, icon: '', color: 'from-yellow-500 to-orange-500' },
                  { label: 'Focus Score', value: twinData.metrics.focus_score, icon: '', color: 'from-blue-500 to-cyan-500' },
                  { label: 'Stress Index', value: `${twinData.metrics.current_stress_score.toFixed(1)}/10`, icon: '', color: twinData.metrics.current_stress_score > 7 ? 'from-red-500 to-orange-500' : 'from-green-500 to-emerald-500' },
                  { label: 'Sleep Deficit', value: `${twinData.metrics.sleep_deficit_hours} hrs`, icon: '', color: 'from-purple-500 to-indigo-500' },
                ].map((metric, i) => (
                  <div
                    key={i}
                    className={`p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                      darkMode
                        ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {metric.label}
                      </h3>
                    <span className="text-2xl group-hover:scale-110 transition-transform"></span>
                    </div>
                    <p className={`text-3xl font-black bg-linear-to-r ${metric.color} bg-clip-text text-transparent`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Agent Analysis Card */}
                <div className={`lg:col-span-2 p-8 rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                  twinData.agent_status.needs_intervention
                    ? darkMode
                      ? 'bg-linear-to-br from-indigo-900/30 to-purple-900/30 border-indigo-500/50'
                      : 'bg-linear-to-br from-indigo-100 to-purple-100 border-indigo-300'
                    : darkMode
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : 'bg-white border-slate-200'
                }`}>
                  <h2 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${
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
                          className={`p-4 rounded-xl backdrop-blur-sm transition-all duration-300 border ${
                            twinData.agent_status.needs_intervention
                              ? darkMode
                                ? 'bg-indigo-900/20 border-indigo-500/20 text-indigo-300'
                                : 'bg-indigo-100 border-indigo-300 text-indigo-800'
                              : darkMode
                              ? 'bg-slate-700/30 border-slate-600/30 text-slate-300'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
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
                <div className={`p-8 rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                  darkMode
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : 'bg-white border-slate-200'
                }`}>
                  <h2 className={`text-2xl font-bold mb-8 flex items-center gap-3 ${
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
                          <span className={`text-sm font-black bg-linear-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent`}>
                            {goal.progress}%
                          </span>
                        </div>
                        <div className={`w-full h-3 rounded-full overflow-hidden backdrop-blur-sm ${
                          darkMode ? 'bg-slate-700/50' : 'bg-slate-200'
                        }`}>
                          <div
                            className="h-full rounded-full bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 shadow-lg shadow-purple-500/20"
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
                  className="px-6 py-3 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isGenerating ? '⏳ Generating...' : '🤖 Generate Schedule with AI'}
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
                  ✓ Verify Tasks
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
                  🔄 Adjust for Missed Tasks
                </button>
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
                    <div key={dayGroup.date} className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm overflow-hidden ${
                      isToday
                        ? darkMode
                          ? 'bg-slate-800/70 border-purple-500/50 shadow-lg shadow-purple-500/10'
                          : 'bg-white border-purple-300 shadow-lg shadow-purple-200/30'
                        : isPast
                        ? darkMode
                          ? 'bg-slate-800/30 border-slate-700/30 opacity-75'
                          : 'bg-slate-50 border-slate-200 opacity-75'
                        : darkMode
                        ? 'bg-slate-800/50 border-slate-700/50'
                        : 'bg-white border-slate-200'
                    }`}>
                      {/* Day Header */}
                      <div className={`px-8 py-5 flex items-center justify-between ${
                        isToday
                          ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10'
                          : ''
                      }`}>
                        <div className="flex items-center gap-3">
                          {isToday && <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>}
                          <div>
                            <h3 className={`text-lg font-black ${
                              isToday
                                ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'
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
                                    ? 'bg-green-900/20 border-green-500/30'
                                    : 'bg-green-50 border-green-300'
                                  : isCompleted
                                  ? darkMode
                                    ? 'bg-green-900/10 border-green-500/20 opacity-80'
                                    : 'bg-green-50/50 border-green-200 opacity-80'
                                  : isMissed
                                  ? darkMode
                                    ? 'bg-red-900/15 border-red-500/30 opacity-70'
                                    : 'bg-red-50 border-red-200 opacity-70'
                                  : darkMode
                                  ? 'bg-slate-700/20 border-slate-600/30 hover:border-purple-500/40 cursor-pointer'
                                  : 'bg-white border-slate-200 hover:border-purple-300 cursor-pointer hover:shadow-md'
                              }`}
                            >
                              {/* Checkbox */}
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                                isAutoVerified
                                  ? 'bg-green-500 border-green-500'
                                  : isCompleted
                                  ? 'bg-purple-500 border-purple-500'
                                  : isMissed
                                  ? 'bg-red-500/30 border-red-500'
                                  : darkMode
                                  ? 'border-slate-500 hover:border-purple-400'
                                  : 'border-slate-300 hover:border-purple-400'
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Method 1: API Sync */}
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                  className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isProcessing ? 'Fetching APIs...' : ' Fetch'}
                </button>
              </div>

              {/* Method 2: NLP Journal */}
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                    className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isProcessing ? ' Extracting Entities...' : ' Analyze & Update Twin'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* --- TRACKING VIEW --- */}
          {activeTab === 'tracking' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* GitHub Status */}
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                        <p className="text-3xl font-black bg-linear-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
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
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                        <p className="text-3xl font-black bg-linear-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
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
              
              {/* GitHub Connection */}
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                    className="px-4 py-2 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400"
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
                      className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50"
                    >
                      {isProcessing ? 'Linking GitHub...' : 'Link GitHub'}
                    </button>
                  </form>
                )}
              </div>

              {/* LeetCode Connection */}
              <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                    className="px-4 py-2 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400"
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
                      className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50"
                    >
                      {isProcessing ? 'Linking LeetCode...' : 'Link LeetCode'}
                    </button>
                  </form>
                )}
              </div>
              {/* Syllabus Management — Full Width */}
              <div className={`col-span-1 lg:col-span-2 rounded-3xl border transition-all duration-300 backdrop-blur-sm ${
                darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'
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
                    className="px-4 py-2 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-colors"
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
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                          syllabusMode === 'text'
                            ? 'bg-linear-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                            : darkMode
                            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        Text Input
                      </button>
                      <button
                        type="button"
                        onClick={() => setSyllabusMode('pdf')}
                        className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                          syllabusMode === 'pdf'
                            ? 'bg-linear-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                            : darkMode
                            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
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
                        className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg disabled:opacity-50"
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
                                ? 'bg-yellow-900/20 border-yellow-500/30'
                                : 'bg-yellow-50 border-yellow-300'
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
                                  ? 'text-red-400'
                                  : isUrgent
                                  ? 'text-yellow-400'
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
                                href={`http://localhost:8000/api/syllabus/${s.id}/pdf`}
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