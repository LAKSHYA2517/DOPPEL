import React, { useState, useEffect } from 'react';

function App() {
  const [twinData, setTwinData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logInput, setLogInput] = useState({ activity_type: 'sleep', duration_hours: 0 });
  const [darkMode, setDarkMode] = useState(true);

  const fetchState = () => {
    fetch('http://localhost:8000/api/twin/state')
      .then(res => res.json())
      .then(data => setTwinData(data));
  };

  useEffect(() => { fetchState(); }, []);

  const handleLogSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:8000/api/twin/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_type: logInput.activity_type,
        duration_hours: parseFloat(logInput.duration_hours)
      })
    }).then(() => {
      fetchState();
      setActiveTab('dashboard');
      setLogInput({ activity_type: 'sleep', duration_hours: 0 }); // reset form
    });
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
              <div className="relative bg-slate-900 p-2 rounded-lg">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <h2 className="text-2xl font-black bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              TwinAgent
            </h2>
          </div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            v1.0 • Review Build
          </p>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 py-6 space-y-3">
          {['dashboard', 'timeline_&_schedule', 'sensor_input'].map(tab => (
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
                {tab === 'dashboard' && ''}
                {tab === 'timeline_&_schedule' && ''}
                {tab === 'sensor_input' && ''}
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
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
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
          
          {/* --- DASHBOARD VIEW --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Coding Streak', value: `${twinData.metrics.coding_streak_days} days`, icon: '', color: 'from-orange-500 to-red-500' },
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

          {/* --- SCHEDULE VIEW --- */}
          {activeTab === 'timeline_&_schedule' && (
            <div className={`rounded-3xl border transition-all duration-300 backdrop-blur-sm animated-in fade-in ${
              darkMode
                ? 'bg-slate-800/50 border-slate-700/50'
                : 'bg-white border-slate-200'
            } p-8`}>
              <h2 className={`text-2xl font-bold mb-8 flex items-center gap-3 ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>
                Dynamic Timeline
              </h2>
              <div className="space-y-3">
                {twinData.schedule.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center p-6 rounded-xl border transition-all duration-300 group hover:scale-102 backdrop-blur-sm ${
                      item.status === 'agent_blocked'
                        ? darkMode
                          ? 'bg-red-900/20 border-red-500/30 opacity-60'
                            : 'bg-red-50 border-red-200 opacity-60'
                          : item.status === 'agent_added'
                          ? darkMode
                            ? 'bg-green-900/20 border-green-500/30 border-dashed'
                            : 'bg-green-50 border-green-200 border-dashed'
                          : darkMode
                          ? 'bg-slate-700/20 border-slate-600/30 hover:border-blue-500/50'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg'
                    }`}
                  >
                    <div className={`w-32 font-mono text-sm font-bold tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {item.time}
                    </div>
                    <div className={`flex-1 text-lg font-semibold transition-all ${
                      item.status === 'agent_blocked'
                        ? `line-through ${darkMode ? 'text-slate-500' : 'text-slate-400'}`
                        : darkMode ? 'text-slate-100' : 'text-slate-800'
                    }`}>
                      {item.task}
                    </div>
                    <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
                      item.status === 'agent_blocked'
                        ? darkMode
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-red-200 text-red-800'
                        : item.status === 'agent_added'
                        ? darkMode
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-green-200 text-green-800'
                        : darkMode
                        ? 'bg-slate-600/50 text-slate-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- SENSOR INPUT VIEW --- */}
          {activeTab === 'sensor_input' && (
            <div className={`max-w-2xl rounded-3xl border transition-all duration-300 backdrop-blur-sm animated-in fade-in ${
              darkMode
                ? 'bg-slate-800/50 border-slate-700/50'
                : 'bg-white border-slate-200'
            } p-10`}>
              <h2 className={`text-2xl font-bold mb-3 flex items-center gap-3 ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>
                Manual Data Ingestion
              </h2>
              <p className={`mb-8 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Simulate realistic sensor data from wearables or IDE monitoring.
              </p>
              
              <form onSubmit={handleLogSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className={`block text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Data Stream Type
                  </label>
                  <select 
                    className={`w-full px-5 py-4 rounded-xl font-semibold transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                      darkMode
                        ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                        : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                    }`}
                    value={logInput.activity_type}
                    onChange={e => setLogInput({...logInput, activity_type: e.target.value})}
                  >
                    <option value="sleep">Biometric: Sleep Recovery</option>
                    <option value="coding">Skill: Coding Session</option>
                    <option value="study">Academic: Deep Work</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className={`block text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Duration (Hours)
                  </label>
                  <input 
                    type="number" 
                    step="0.5"
                    className={`w-full px-5 py-4 rounded-xl font-semibold transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-500 border ${
                      darkMode
                        ? 'bg-slate-700/50 border-slate-600/50 text-slate-100 focus:border-purple-500'
                        : 'bg-white border-slate-300 text-slate-800 focus:border-transparent'
                    }`}
                    value={logInput.duration_hours}
                    onChange={e => setLogInput({...logInput, duration_hours: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 px-6 rounded-xl font-bold text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 shadow-lg"
                >
                  Transmit to Twin State
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;