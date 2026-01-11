import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, 
  Swords, 
  Hourglass, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  Monitor, 
  Eye, 
  ScanEye,
  Crosshair,
  Settings,
  Target,
  Plus,
  Minus,
  Maximize,
  Calendar,
  LayoutList,
  Calculator,
  User,
  Zap,
  Ban,
  Trash2,
  RotateCcw,
  Users,
  X,
  Timer,
  ImageIcon,
  ArrowRight,
  Info,
  Upload,
  FileDown,
  FileText,
  History,
  Save,
  Archive,
  Trophy,
  Skull,
  Download,
  BookOpen
} from 'lucide-react';
import { useBattleSync } from './useBattleSync';

// --- Global Helpers ---

const toSeconds = (t) => {
    if (!t) return 0;
    return (parseInt(t.h || 0) * 3600) + (parseInt(t.m || 0) * 60) + (parseInt(t.s || 0));
};

const fromSeconds = (totalSec) => {
  if (totalSec < 0) return { h: 0, m: 0, s: 0 };
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return { h, m, s };
};

const formatMinSec = (totalSeconds) => {
  if (totalSeconds < 0) return "0m 0s";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m ${s}s`;
  }
  return `${m}m ${s}s`;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Hardcoded mappings based on game mechanics
const MARCH_TIME_MAPPING = {
  36: 30,
  39: 33,
  43: 36,
  48: 40
};

// Updated Logic
const getEffectiveMarchTime = (inputTime, isPetActive) => {
  const t = parseInt(inputTime) || 0;
  if (!isPetActive) return t;

  // If the time matches one of our known spots, use the hardcoded value
  if (MARCH_TIME_MAPPING[t]) {
    return MARCH_TIME_MAPPING[t];
  }

  // Fallback for manual/custom inputs: default formula
  // Input Time is 125% speed. Active is 155% speed.
  return Math.floor(t * (1.25 / 1.55));
};

// Helper to check if a calculation is custom (formula based)
const isCustomCalculation = (inputTime) => {
    const t = parseInt(inputTime) || 0;
    return !MARCH_TIME_MAPPING[t];
};

// Function to compare two image data arrays (pixel by pixel)
const calculatePatternDiff = (data1, data2) => {
  if (!data1 || !data2 || data1.length !== data2.length) return 255; // Max diff if mismatch

  let totalDiff = 0;
  // Step by 4 (R, G, B, A)
  for (let i = 0; i < data1.length; i += 4) {
    // Simple sum of absolute differences for R, G, B
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i+1] - data2[i+1]);
    const bDiff = Math.abs(data1[i+2] - data2[i+2]);
    
    totalDiff += (rDiff + gDiff + bDiff);
  }
  
  // Normalize per pixel (3 channels)
  const pixelCount = data1.length / 4;
  return totalDiff / (pixelCount * 3); // Average difference per channel per pixel (0-255)
};

// --- Storage Helper ---
const getSavedState = (key, initialValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading state", e);
  }
  return initialValue;
};


// --- Visual Timeline Component ---
const VisualTimeline = ({ logs }) => {
  if (!logs || logs.length === 0) return null;

  // Sort logs by time (id is timestamp)
  const sortedLogs = [...logs].sort((a, b) => a.id - b.id);
  const startTime = sortedLogs[0].id;
  const endTime = sortedLogs[sortedLogs.length - 1].id;
  const totalDuration = endTime - startTime;

  if (totalDuration === 0) return <div className="text-center text-xs text-slate-500 p-4">Not enough data for timeline visualization</div>;

  // 1. Build Occupation Segments
  const segments = [];
  let currentOwner = 'neutral';
  let segmentStart = startTime;

  // Helper to parse owner from log message
  const getOwnerFromLog = (msg) => {
    if (msg.includes('OURS')) return 'us';
    if (msg.includes('ENEMY')) return 'enemy';
    return 'neutral';
  };

  sortedLogs.forEach((log) => {
    if (log.type === 'occupation') {
      // End previous segment
      segments.push({
        owner: currentOwner,
        start: segmentStart,
        end: log.id,
        width: ((log.id - segmentStart) / totalDuration) * 100
      });
      // Start new segment
      currentOwner = getOwnerFromLog(log.message);
      segmentStart = log.id;
    }
  });

  // Push final segment
  segments.push({
    owner: currentOwner,
    start: segmentStart,
    end: endTime,
    width: ((endTime - segmentStart) / totalDuration) * 100
  });

  // 2. Filter Point Events (Pets AND Victory)
  const pointEventsRaw = sortedLogs.filter(l => ['pet', 'victory'].includes(l.type)).map(log => ({
    ...log,
    left: ((log.id - startTime) / totalDuration) * 100
  }));

  // Assign stack levels (slots) to events to prevent visual overlap
  const pointEvents = [];
  pointEventsRaw.forEach((ev) => {
      // Find a slot that doesn't conflict with recent events
      let slot = 0;
      const threshold = 5; // % width threshold for overlap
      
      while (true) {
          // Check if any existing event in this slot is too close
          const collision = pointEvents.some(prev => 
             prev.slot === slot && Math.abs(prev.left - ev.left) < threshold
          );
          
          if (!collision) {
              break;
          }
          slot++;
      }
      pointEvents.push({ ...ev, slot });
  });


  // Helper for UTC formatting in timeline
  const formatTimeUTC = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
        timeZone: 'UTC', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
  };

  return (
    <div className="w-full p-4 bg-slate-900/50 rounded-lg border border-slate-700 mb-4 shadow-inner">
      <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
         <Clock size={12}/> Battle Visualization
      </h4>
      
      {/* Timeline Container - Increased Height for Stacking */}
      <div className="relative w-full h-64 mt-4">
        
        {/* Occupation Bar (Background) - Positioned at bottom */}
        <div className="absolute bottom-8 left-0 right-0 h-4 bg-slate-800 rounded-full overflow-hidden flex border border-slate-600/50 z-0">
          {segments.map((seg, i) => (
            <div 
              key={i}
              style={{ width: `${seg.width}%` }}
              className={`h-full ${
                seg.owner === 'us' ? 'bg-blue-600' : 
                seg.owner === 'enemy' ? 'bg-red-600' : 'bg-slate-700'
              } transition-all`}
              title={`${seg.owner.toUpperCase()}: ${formatTimeUTC(seg.start)} - ${formatTimeUTC(seg.end)}`}
            />
          ))}
        </div>

        {/* Markers (Overlay) - Stacking upwards from the bar */}
        {pointEvents.map((ev, i) => {
          // Determine color based on side and type
          const isUs = ev.side === 'us';
          const isEnemy = ev.side === 'enemy';
          const isVictory = ev.type === 'victory';
          
          let markerColorClass = 'text-yellow-500 border-yellow-500'; // Fallback
          let lineColorClass = 'bg-yellow-500/50';
          let Icon = Zap;
          let iconSize = 8;

          if (isVictory) {
              markerColorClass = 'text-yellow-400 border-yellow-400 bg-yellow-900 text-yellow-100 ring-2 ring-yellow-500';
              lineColorClass = 'bg-yellow-500';
              Icon = Trophy;
              iconSize = 10;
          } else if (isUs) {
            markerColorClass = 'text-cyan-400 border-cyan-400 bg-cyan-950';
            lineColorClass = 'bg-cyan-400/50';
          } else if (isEnemy) {
            markerColorClass = 'text-orange-500 border-orange-500 bg-orange-950';
            lineColorClass = 'bg-orange-500/50';
          }

          // Calculate vertical position based on slot
          const bottomPos = 48 + (ev.slot * 24); 
          const lineHeight = bottomPos - 32;

          return (
            <div 
              key={i}
              className="absolute transform -translate-x-1/2 flex flex-col items-center group z-10 hover:z-50"
              style={{ left: `${ev.left}%`, bottom: `${bottomPos}px` }}
            >
              {/* Hover Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 bg-black/90 border border-slate-600 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity shadow-xl z-50">
                 <span className={`font-bold block mb-0.5 ${isVictory ? 'text-yellow-300' : isUs ? 'text-cyan-400' : isEnemy ? 'text-orange-500' : 'text-yellow-400'}`}>
                    {isVictory ? 'BATTLE OUTCOME' : formatTimeUTC(ev.id) + ' (UTC)'}
                 </span>
                 {ev.message}
              </div>
              
              {/* Icon */}
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-sm cursor-help hover:scale-125 transition-transform z-20 ${markerColorClass}`}>
                 <Icon size={iconSize} />
              </div>

               {/* Connector Line to Bar */}
               <div 
                 className={`w-0.5 absolute top-full left-1/2 -translate-x-1/2 z-0 ${lineColorClass}`}
                 style={{ height: `${lineHeight}px` }}
               ></div>
            </div>
          );
        })}
        
        {/* Start/End Labels */}
        <div className="absolute bottom-0 left-0 text-[10px] text-slate-500 -translate-x-2 font-mono">
           {formatTimeUTC(startTime)}
        </div>
        <div className="absolute bottom-0 right-0 text-[10px] text-slate-500 translate-x-2 font-mono">
           {formatTimeUTC(endTime)}
        </div>

      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2 justify-center text-[10px] text-slate-400 bg-black/20 p-2 rounded border border-white/5">
         <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-600 rounded-full ring-1 ring-white/10"></div> Us Occ.</div>
         <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-600 rounded-full ring-1 ring-white/10"></div> Enemy Occ.</div>
         <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-700 rounded-full ring-1 ring-white/10"></div> Neutral</div>
         
         {/* Pet Legend */}
         <div className="flex items-center gap-3 border-l border-slate-700 pl-3 ml-1">
             <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-cyan-400"/> Us Pet
             </div>
             <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-orange-500"/> Enemy Pet
             </div>
             <div className="flex items-center gap-1.5">
                <Trophy size={10} className="text-yellow-400"/> Victory/Defeat
             </div>
         </div>
      </div>
    </div>
  );
};


// --- Utility Components ---

const TimeInput = ({ label, value, onChange, colorClass, readOnly = false }) => {
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const handleChange = (field, val) => {
    if (readOnly) return; // Prevent typing in readOnly mode
    let newValue = parseInt(val) || 0;
    // Basic clamping
    if (newValue < 0) newValue = 0;
    if (field === 'h' && newValue > 5) newValue = 5;
    if ((field === 'm' || field === 's') && newValue > 59) newValue = 59;

    onChange({ ...value, [field]: newValue });
  };

  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const startAdjust = (delta) => {
    const adjust = () => {
      const currentSec = toSeconds(valueRef.current);
      const newSec = currentSec + delta;
      if (newSec >= 0) {
        onChange(fromSeconds(newSec));
      }
    };
    // Immediate execution
    adjust();
    // Rapid fire after hold
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(adjust, 100); 
    }, 500); 
  };

  const stopAdjust = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAdjust();
  }, []);

  return (
    <div className={`relative p-4 rounded-xl border border-opacity-20 bg-opacity-10 ${colorClass} flex flex-col gap-2 transition-all ${readOnly ? 'opacity-90' : ''}`}>
      
      {/* Overlay to block direct typing in Live Mode, but sit behind the adjustment buttons */}
      {readOnly && <div className="absolute inset-0 bg-transparent z-10 cursor-not-allowed" title="Direct typing disabled. Use +/- buttons." />}

      {/* Header with Label and Adjustment Buttons (z-20 to sit above overlay) */}
      <div className="flex justify-between items-center relative z-20">
        <label className="text-sm font-bold uppercase tracking-wider opacity-90 flex items-center gap-2">
          {label}
        </label>
        
        {/* Adjustment Controls */}
        <div className="flex items-center gap-1">
          <button 
             onMouseDown={(e) => { if(e.cancelable) e.preventDefault(); startAdjust(-1); }}
             onMouseUp={stopAdjust}
             onMouseLeave={stopAdjust}
             onTouchStart={(e) => { if(e.cancelable) e.preventDefault(); startAdjust(-1); }}
             onTouchEnd={stopAdjust}
             className="p-1.5 rounded bg-slate-900/50 hover:bg-slate-900 text-white/70 hover:text-white border border-white/10 transition-colors select-none"
             title="Subtract 1 Second (Hold to repeat)"
          >
             <Minus size={14} />
          </button>
          <button 
             onMouseDown={(e) => { if(e.cancelable) e.preventDefault(); startAdjust(1); }}
             onMouseUp={stopAdjust}
             onMouseLeave={stopAdjust}
             onTouchStart={(e) => { if(e.cancelable) e.preventDefault(); startAdjust(1); }}
             onTouchEnd={stopAdjust}
             className="p-1.5 rounded bg-slate-900/50 hover:bg-slate-900 text-white/70 hover:text-white border border-white/10 transition-colors select-none"
             title="Add 1 Second (Hold to repeat)"
          >
             <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 items-center relative z-0">
        <div className="flex-1">
          <input
            type="number"
            className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-center text-lg font-mono focus:outline-none focus:border-blue-500 ${readOnly ? 'text-slate-400' : ''}`}
            placeholder="HH"
            value={value.h}
            onChange={(e) => handleChange('h', e.target.value)}
            readOnly={readOnly}
          />
          <span className="text-xs text-slate-400 text-center block mt-1">Hrs</span>
        </div>
        <span className="text-xl font-bold pb-4">:</span>
        <div className="flex-1">
          <input
            type="number"
            className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-center text-lg font-mono focus:outline-none focus:border-blue-500 ${readOnly ? 'text-slate-400' : ''}`}
            placeholder="MM"
            value={value.m}
            onChange={(e) => handleChange('m', e.target.value)}
            readOnly={readOnly}
          />
          <span className="text-xs text-slate-400 text-center block mt-1">Min</span>
        </div>
        <span className="text-xl font-bold pb-4">:</span>
        <div className="flex-1">
          <input
            type="number"
            className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-center text-lg font-mono focus:outline-none focus:border-blue-500 ${readOnly ? 'text-slate-400' : ''}`}
            placeholder="SS"
            value={value.s}
            onChange={(e) => handleChange('s', e.target.value)}
            readOnly={readOnly}
          />
          <span className="text-xs text-slate-400 text-center block mt-1">Sec</span>
        </div>
      </div>
    </div>
  );
};

const PetStatusBadge = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      setTimeLeft(remaining > 0 ? remaining : 0);
    }, 1000);
    // Initial set
    const remaining = expiresAt - Date.now();
    setTimeLeft(remaining > 0 ? remaining : 0);
    
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return (
    <div className="flex items-center gap-1 text-slate-500 bg-slate-800/50 px-2 py-1 rounded text-[10px] font-bold border border-slate-700">
       <Zap size={10} /> READY
    </div>
  );

  if (timeLeft <= 0) return (
    <div className="flex items-center gap-1 text-slate-500 bg-slate-800/50 px-2 py-1 rounded text-[10px] font-bold border border-slate-700">
       <Ban size={10} /> USED
    </div>
  );

  return (
    <div className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-1 rounded text-[10px] font-mono font-bold border border-amber-900/50">
       <Zap size={10} className="fill-amber-500 animate-pulse" /> {formatCountdown(timeLeft)}
    </div>
  );
};

// --- Rally Lead Component (Manager View) ---
const RallyLeadCard = ({ lead, onUpdate, onDelete }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  // Update timer logic
  useEffect(() => {
    const checkTime = () => {
      if (!lead.petExpiresAt) return;
      const remaining = lead.petExpiresAt - Date.now();
      setTimeLeft(remaining > 0 ? remaining : 0);
    };
    
    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [lead.petExpiresAt]);

  const activatePet = () => {
    // Set expiry 2 hours from now
    const twoHoursMs = 2 * 60 * 60 * 1000;
    onUpdate(lead.id, { petExpiresAt: Date.now() + twoHoursMs });
  };
  
  const reducePetTime = () => {
      if (lead.petExpiresAt) {
          // Reduce by 1 minute
          const newExpiry = lead.petExpiresAt - 60000;
          onUpdate(lead.id, { petExpiresAt: newExpiry });
      }
  };

  const resetPet = () => {
    onUpdate(lead.id, { petExpiresAt: null });
  };

  const isExhausted = lead.petExpiresAt && timeLeft <= 0;
  const isActive = lead.petExpiresAt && timeLeft > 0;
  
  const effectiveTime = getEffectiveMarchTime(lead.marchTime, isActive);
  const isEstimated = isActive && isCustomCalculation(lead.marchTime);

  return (
    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col gap-3">
      <div className="flex justify-between items-start">
         <div className="flex-1 space-y-2">
            {/* Name Input */}
            <div className="flex items-center gap-2">
               <User size={16} className="text-slate-500"/>
               <input 
                  type="text" 
                  value={lead.name}
                  onChange={(e) => onUpdate(lead.id, { name: e.target.value })}
                  placeholder="Rally Lead Name"
                  className="bg-transparent border-b border-slate-700 focus:border-indigo-500 outline-none text-sm font-bold w-full"
               />
            </div>
            
            {/* March Time Input & Quick Selects */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                   <Clock size={16} className="text-slate-500"/>
                   <input 
                      type="number" 
                      value={lead.marchTime}
                      onChange={(e) => onUpdate(lead.id, { marchTime: e.target.value })}
                      placeholder="March Time (seconds)"
                      className="bg-transparent border-b border-slate-700 focus:border-indigo-500 outline-none text-sm text-slate-300 w-full font-mono"
                   />
                   {/* Effective Time Display (if active) */}
                   {isActive && (
                       <div 
                          className="flex items-center gap-1 text-xs font-mono text-green-400 bg-green-900/30 px-2 py-0.5 rounded border border-green-500/30 cursor-help"
                          title={isEstimated ? "Calculated via formula (1.25 -> 1.55 speedup)" : "Using hardcoded value"}
                       >
                           <ArrowRight size={12} /> {effectiveTime}s {isEstimated && <span className="text-[9px] opacity-70 ml-0.5">(Est.)</span>}
                       </div>
                   )}
                </div>
                {/* Quick Select Buttons */}
                <div className="flex items-center gap-1 pl-6">
                   {[36, 39, 43, 48].map(time => (
                      <button 
                         key={time}
                         onClick={() => onUpdate(lead.id, { marchTime: time })}
                         className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            parseInt(lead.marchTime) === time 
                            ? 'bg-blue-600 border-blue-400 text-white' 
                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                         }`}
                      >
                         {time}s
                      </button>
                   ))}
                </div>
            </div>
         </div>
         <button 
            onClick={() => onDelete(lead.id)}
            className="text-slate-600 hover:text-red-400 transition-colors"
         >
            <Trash2 size={16} />
         </button>
      </div>

      {/* Pet Status Section */}
      <div className="border-t border-slate-800 pt-3 mt-1">
         {!lead.petExpiresAt && (
            <button 
               onClick={activatePet}
               className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 py-2 rounded text-xs font-bold transition-all border border-slate-700"
            >
               <Zap size={14} /> ACTIVATE PET (2H)
            </button>
         )}

         {isActive && (
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-amber-500/10 border border-amber-500/50 rounded py-2 px-3 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-amber-500 text-xs font-bold">
                      <Zap size={14} className="fill-amber-500 animate-pulse"/> ACTIVE
                   </div>
                   <span className="font-mono text-sm font-bold text-amber-400">
                      {formatCountdown(timeLeft)}
                   </span>
                </div>
                <button 
                   onClick={reducePetTime}
                   className="h-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-amber-400 hover:text-amber-200 transition-colors"
                   title="Reduce time by 1 minute"
                >
                   <Minus size={14} />
                </button>
                <button 
                   onClick={resetPet}
                   className="h-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                   title="Reset Pet Status"
                >
                   <RotateCcw size={14} />
                </button>
            </div>
         )}

         {isExhausted && (
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded py-2 px-3 flex items-center justify-center gap-2 text-slate-500 text-xs font-bold">
                   <Ban size={14} /> PET EXHAUSTED
                </div>
                <button 
                   onClick={resetPet}
                   className="h-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                   title="Reset Pet Status"
                >
                   <RotateCcw size={14} />
                </button>
            </div>
         )}
      </div>
    </div>
  );
};

// --- Rally Group Card (Group View) ---
const RallyGroupCard = ({ group, members, availableLeads, onAssign, onRemove, onActivatePet, onDelete, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);

  // Calculate March Time Range based on EFFECTIVE time
  const calculateMarchRange = () => {
    const times = members
        .map(m => {
            const isActive = m.petExpiresAt && (m.petExpiresAt - Date.now() > 0);
            return getEffectiveMarchTime(m.marchTime, isActive);
        })
        .filter(t => t > 0);
    
    if (times.length === 0) return 'N/A';
    
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    if (min === max) return `${min}s`;
    return `${min}s - ${max}s`;
  };

  const marchRange = calculateMarchRange();

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-lg">
       {/* Group Header */}
       <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-start">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">{group.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {members.length} Leads
                </span>
             </div>
             {/* March Range Display */}
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">March Range:</span>
                <span className="text-xs font-bold font-mono text-indigo-300 bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    {marchRange}
                </span>
             </div>
          </div>
          <button 
             onClick={() => onDelete(group.id)}
             className="text-slate-600 hover:text-red-500 transition-colors p-1"
             title="Delete Group"
          >
             <Trash2 size={16} />
          </button>
       </div>
       
       <div className="p-2 flex flex-col gap-2 min-h-[100px]">
          {members.length === 0 && !isAdding && (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs italic py-4">
                No leads assigned
             </div>
          )}

          {members.map(lead => {
             const isActive = lead.petExpiresAt && (lead.petExpiresAt - Date.now() > 0);
             const effectiveTime = getEffectiveMarchTime(lead.marchTime, isActive);
             const isEstimated = isActive && isCustomCalculation(lead.marchTime);
             
             return (
             <div key={lead.id} className="bg-slate-800 p-2.5 rounded-lg flex items-center justify-between group relative border border-white/5 hover:border-indigo-500/30 transition-colors">
                <div className="flex flex-col w-full">
                   <div className="flex justify-between items-center mb-1.5">
                       <span className="text-sm font-bold text-white truncate max-w-[120px]">{lead.name || "Unknown"}</span>
                       <button 
                           onClick={() => onRemove(lead.id)}
                           className="text-slate-600 hover:text-red-400 p-1"
                           title="Remove from group"
                        >
                           <X size={14} />
                        </button>
                   </div>
                   
                   <div className="flex items-center justify-between mt-1">
                      {/* Highlighted March Time */}
                      <span 
                        className={`text-sm font-black text-white shadow-md px-2 py-1 rounded flex items-center gap-1.5 border ${isActive ? 'bg-green-600 border-green-400/50' : 'bg-blue-600 border-blue-400/50'}`}
                        title={isEstimated ? "Calculated via formula" : ""}
                      >
                         <Timer size={14} /> {effectiveTime}s {isEstimated && <span className="text-[9px] align-top">*</span>}
                      </span>
                      
                      {/* Pet Status / Activation */}
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {!lead.petExpiresAt ? (
                            <button 
                                onClick={() => onActivatePet(lead.id)}
                                className="flex items-center gap-1 text-[10px] bg-slate-700 hover:bg-indigo-600 text-white px-2 py-1 rounded border border-slate-600 transition-colors font-bold uppercase tracking-wide"
                                title="Activate Pet (2h)"
                            >
                                <Zap size={10} /> ACTIVATE
                            </button>
                        ) : (
                            <>
                                <PetStatusBadge expiresAt={lead.petExpiresAt} />
                                {isActive && (
                                    <button 
                                       onClick={() => onUpdate(lead.id, { petExpiresAt: lead.petExpiresAt - 60000 })}
                                       className="p-1 bg-slate-700 hover:bg-slate-600 text-amber-400 rounded border border-slate-600"
                                       title="-1 Minute"
                                    >
                                       <Minus size={10} />
                                    </button>
                                )}
                            </>
                        )}
                      </div>
                   </div>
                </div>
             </div>
          )})}

          {/* Add Member UI */}
          {!isAdding ? (
             <button 
               onClick={() => setIsAdding(true)}
               className="mt-2 w-full py-2.5 border border-dashed border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-900/10 rounded text-xs font-bold transition-all flex items-center justify-center gap-1"
             >
                <Plus size={14} /> ASSIGN LEAD
             </button>
          ) : (
             <div className="mt-2 p-2 bg-black/60 backdrop-blur rounded border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-2 px-1">
                   <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Select Lead to Add</span>
                   <button onClick={() => setIsAdding(false)}><X size={14} className="text-slate-400 hover:text-white"/></button>
                </div>
                <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                   {availableLeads.length > 0 ? availableLeads.map(lead => (
                      <button 
                         key={lead.id}
                         onClick={() => { onAssign(lead.id, group.id); setIsAdding(false); }}
                         className="text-left text-xs text-slate-300 hover:bg-indigo-600 hover:text-white p-2 rounded transition-colors flex justify-between items-center group"
                      >
                         <span className="font-bold">{lead.name || "Unnamed"}</span>
                         <span className="font-mono opacity-70 group-hover:opacity-100">{lead.marchTime || 0}s</span>
                      </button>
                   )) : (
                      <span className="text-[10px] text-slate-500 italic p-2 text-center">No unassigned leads available</span>
                   )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};


// --- Main App ---

const App = () => {
  // --- State ---
  const [currentTab, setCurrentTab] = useState('calculator'); 
  const [recordsView, setRecordsView] = useState('current'); 
  
  // 1. Sync Hook Integration
  const { battleState, updateBattleState, loading } = useBattleSync();

  // 2. Smart Setter Factory
  // Creates a setter that updates local state AND sends updates to Firebase
  const createSmartSetter = (key, localSetter) => (value) => {
      localSetter(prev => {
          const resolvedValue = typeof value === 'function' ? value(prev) : value;
          // Fire-and-forget update to Firestore (merges with existing doc)
          updateBattleState({ [key]: resolvedValue });
          return resolvedValue;
      });
  };

  // 3. State Initialization
  // We define a local state variable (e.g., _ourTime) and a smart setter (setOurTime).
  // The rest of the app uses 'ourTime' and 'setOurTime', so no UI changes are needed.

  const [ourTimeState, _setOurTime] = useState({ h: 0, m: 0, s: 0 });
  const ourTime = ourTimeState;
  const setOurTime = createSmartSetter('ourTime', _setOurTime);

  const [enemyTimeState, _setEnemyTime] = useState({ h: 0, m: 0, s: 0 });
  const enemyTime = enemyTimeState;
  const setEnemyTime = createSmartSetter('enemyTime', _setEnemyTime);

  const [remainingTimeState, _setRemainingTime] = useState({ h: 5, m: 0, s: 0 });
  const remainingTime = remainingTimeState;
  const setRemainingTime = createSmartSetter('remainingTime', _setRemainingTime);
  
  const [castleOwnerState, _setCastleOwner] = useState('neutral');
  const castleOwner = castleOwnerState;
  const setCastleOwner = createSmartSetter('castleOwner', _setCastleOwner);
  
  const [battleStartTimeState, _setBattleStartTime] = useState(null);
  const battleStartTime = battleStartTimeState;
  const setBattleStartTime = createSmartSetter('battleStartTime', _setBattleStartTime);

  const [lastTickState, _setLastTick] = useState(0);
  const lastTick = lastTickState;
  const setLastTick = createSmartSetter('lastTick', _setLastTick);

  const [rallyLeadsState, _setRallyLeads] = useState([]); 
  const rallyLeads = rallyLeadsState;
  const setRallyLeads = createSmartSetter('rallyLeads', _setRallyLeads);
  
  const [groupsState, _setGroups] = useState([
     { id: 'u1', side: 'us', name: 'Group 1' },
     { id: 'u2', side: 'us', name: 'Group 2' },
     { id: 'u3', side: 'us', name: 'Group 3' },
     { id: 'e1', side: 'enemy', name: 'Group 1' },
     { id: 'e2', side: 'enemy', name: 'Group 2' },
     { id: 'e3', side: 'enemy', name: 'Group 3' },
  ]);
  const groups = groupsState;
  const setGroups = createSmartSetter('groups', _setGroups);

  const [battleLogState, _setBattleLog] = useState([]);
  const battleLog = battleLogState;
  const setBattleLog = createSmartSetter('battleLog', _setBattleLog);

  // 4. Sync Effect (Read)
  // When Firestore data arrives via the hook, update local state
  useEffect(() => {
    if (!loading && battleState) {
        _setOurTime(battleState.ourTime);
        _setEnemyTime(battleState.enemyTime);
        _setRemainingTime(battleState.remainingTime);
        _setCastleOwner(battleState.castleOwner);
        _setBattleStartTime(battleState.battleStartTime);
        _setLastTick(battleState.lastTick);
        _setRallyLeads(battleState.rallyLeads || []);
        _setGroups(battleState.groups || []);
        _setBattleLog(battleState.battleLog || []);
    }
  }, [loading, battleState]);

  // --- Local Only States (Not synced via useBattleSync) ---
  const [isTimerRunning, setIsTimerRunning] = useState(false); // UI state only
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartTime, setAutoStartTime] = useState("12:00:00");
  const [currentUtc, setCurrentUtc] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null); 
  const [isScreenShared, setIsScreenShared] = useState(false);
  
  const [autoTrackEnabled, setAutoTrackEnabled] = useState(false);
  const [targetPixel, setTargetPixel] = useState(null); 
  const [scanSize, setScanSize] = useState(40);

  const usPatternRef = useRef(null);
  const enemyPatternRef = useRef(null);

  const [hasUsPattern, setHasUsPattern] = useState(false);
  const [hasEnemyPattern, setHasEnemyPattern] = useState(false);
  const [colorTolerance, setColorTolerance] = useState(30); 
  const [debugDiff, setDebugDiff] = useState({ us: null, enemy: null });
  const [debugMatch, setDebugMatch] = useState('none'); 

  const [results, setResults] = useState(null);

  // History is kept local for now (or use separate collection later)
  const [savedBattles, setSavedBattles] = useState(() => {
    try {
      const saved = localStorage.getItem('savedBattles');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => localStorage.setItem('savedBattles', JSON.stringify(savedBattles)), [savedBattles]);

  const [battleName, setBattleName] = useState("");
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [isHydrated, setIsHydrated] = useState(true); // Handled by hook now

  const historyFileInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Logging Helper ---
  // Memoize addLog with useCallback to prevent infinite loops in useEffect
  const addLog = useCallback((message, type = 'system', side = null) => {
      const now = new Date();
      // Format: YYYY-MM-DD HH:MM:SS UTC
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const min = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;

      const entry = {
          id: Date.now(),
          timestamp: timestamp,
          message,
          type,
          side
      };
      setBattleLog(prev => [entry, ...prev]);
  }, []); // Empty dependency array as it only uses setBattleLog which is stable

  // Log Castle Owner Changes & Victory
  const prevOwnerRef = useRef(castleOwner);
  const prevStatusRef = useRef(null);

  useEffect(() => {
      if (prevOwnerRef.current !== castleOwner) {
          const ownerText = castleOwner === 'us' ? 'OURS' : castleOwner === 'enemy' ? 'ENEMY' : 'NEUTRAL';
          addLog(`Castle ownership changed to: ${ownerText}`, 'occupation');
          prevOwnerRef.current = castleOwner;
      }
  }, [castleOwner, addLog]);

  useEffect(() => {
      if (results && prevStatusRef.current !== results.status) {
          if (results.status === 'won') addLog("Victory Determined: Score gap is insurmountable!", 'victory');
          if (results.status === 'lost') addLog("Defeat Determined: Unable to catch up mathematically.", 'victory');
          prevStatusRef.current = results.status;
      }
  }, [results, addLog]);


  // --- Helpers for Rally ---
  const addRallyLead = (side) => {
    const newLead = {
      id: Date.now(),
      side,
      name: '',
      marchTime: '',
      petExpiresAt: null,
      groupId: null 
    };
    setRallyLeads([...rallyLeads, newLead]);
    addLog(`New ${side === 'us' ? 'Friendly' : 'Enemy'} Rally Lead added`, 'rally');
  };

  // Updated updateRallyLead to handle pet activation logging
  const updateRallyLead = (id, updates) => {
    // Check for logging triggers BEFORE updating state to have access to current name
    const lead = rallyLeads.find(l => l.id === id);
    if (lead) {
        if (updates.petExpiresAt && typeof updates.petExpiresAt === 'number') {
            // Activation (check if future time)
            if (updates.petExpiresAt > Date.now()) {
                 addLog(`Pet activated for ${lead.name || 'Unnamed Lead'}`, 'pet', lead.side);
            }
        }
        // Log resets if explicitly set to null
        if (updates.petExpiresAt === null) {
             addLog(`Pet status reset for ${lead.name || 'Unnamed Lead'}`, 'pet', lead.side);
        }
        
        // Log march time changes
        if (updates.marchTime !== undefined && updates.marchTime != lead.marchTime) {
             // Avoid logging if converting from string "48" to number 48 or vice versa creates noise, but != handles that.
             // Also check if it's just initialization (0 -> 0)
             if (lead.marchTime != updates.marchTime) {
                 addLog(`March time updated for ${lead.name || 'Unnamed Lead'}: ${lead.marchTime || 0}s -> ${updates.marchTime}s`, 'rally');
             }
        }
    }

    setRallyLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteRallyLead = (id) => {
    setRallyLeads(rallyLeads.filter(l => l.id !== id));
    addLog("Rally Lead deleted", 'rally');
  };

  const assignLeadToGroup = (leadId, groupId) => {
    const groupName = groups.find(g => g.id === groupId)?.name || "Group";
    updateRallyLead(leadId, { groupId });
    addLog(`Lead assigned to ${groupName}`, 'group');
  };

  const removeLeadFromGroup = (leadId) => {
    updateRallyLead(leadId, { groupId: null });
    addLog("Lead removed from group", 'group');
  };

  // Add a new Group dynamically
  const addGroup = (side) => {
      const currentCount = groups.filter(g => g.side === side).length;
      const newGroup = {
          id: `${side}-${Date.now()}`,
          side: side,
          name: `Group ${currentCount + 1}`
      };
      setGroups([...groups, newGroup]);
      addLog(`New ${side === 'us' ? 'Friendly' : 'Enemy'} Group created`, 'group');
  };

  // Delete Group and unassign leads
  const deleteGroup = (groupId) => {
      setGroups(groups.filter(g => g.id !== groupId));
      // Unassign leads in that group
      setRallyLeads(rallyLeads.map(lead => 
          lead.groupId === groupId ? { ...lead, groupId: null } : lead
      ));
      addLog("Group deleted", 'group');
  };

  // Activate pet from group view (same 2h logic)
  const handleActivatePetFromGroup = (leadId) => {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      updateRallyLead(leadId, { petExpiresAt: Date.now() + twoHoursMs });
  };
  
  // RESET BATTLE FUNCTION
  const resetBattle = () => {
    if (window.confirm("⚠️ Are you sure you want to RESET the battle?\n\nThis will:\n• Stop the timer\n• Reset scores to 0\n• Reset battle time to 5h\n• Reset castle to Neutral\n• Reset ALL Pet Cooldowns\n• Clear current logs\n\nThis cannot be undone!")) {
          setIsTimerRunning(false);
          setBattleStartTime(null);
          setLastTick(0);
          setOurTime({ h: 0, m: 0, s: 0 });
          setEnemyTime({ h: 0, m: 0, s: 0 });
          setRemainingTime({ h: 5, m: 0, s: 0 });
          setCastleOwner('neutral');
          setBattleLog([]);
          setResults(null);
          setAutoStartEnabled(false);
          
          // Reset all pets
          setRallyLeads(prev => prev.map(lead => ({ ...lead, petExpiresAt: null })));

          // Clear from storage immediately
          localStorage.removeItem('battleStartTime');
          localStorage.removeItem('lastTick');
          localStorage.removeItem('ourTime');
          localStorage.removeItem('enemyTime');
          localStorage.removeItem('remainingTime');
          localStorage.removeItem('castleOwner');
          localStorage.removeItem('battleLog');
          
          // We don't remove rallyLeads from storage here, just update state, 
          // effectively keeping the leads but clearing pets.
          
          addLog("Battle Reset - New Session Started", 'system');
    }
  };

  const saveBattleLog = () => {
    if (!battleName.trim()) {
      alert("Please enter a name for this battle.");
      return;
    }
    const newRecord = {
      id: Date.now(),
      name: battleName,
      date: new Date().toISOString(),
      logs: battleLog,
      finalOurTime: ourTime,
      finalEnemyTime: enemyTime,
      winner: ourTime.h*3600 + ourTime.m*60 + ourTime.s > enemyTime.h*3600 + enemyTime.m*60 + enemyTime.s ? 'us' : 'enemy'
    };
    setSavedBattles([newRecord, ...savedBattles]);
    setBattleName("");
    alert("Battle Saved to History!");
  };

  const deleteSavedBattle = (id) => {
    if(window.confirm("Delete this battle record?")) {
      setSavedBattles(savedBattles.filter(b => b.id !== id));
      if (selectedBattle && selectedBattle.id === id) setSelectedBattle(null);
    }
  };

  // Export Specific Battle (History Tab)
  const exportBattle = (battle) => {
      if (!battle) return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(battle, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${(battle.name || "battle").replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  // Export Current Session (Logs Tab)
  const exportCurrentSession = () => {
      const sessionBattle = {
          id: Date.now(),
          name: battleName || "Current Session",
          date: new Date().toISOString(),
          logs: battleLog,
          finalOurTime: ourTime,
          finalEnemyTime: enemyTime,
          winner: ourTime.h*3600 + ourTime.m*60 + ourTime.s > enemyTime.h*3600 + enemyTime.m*60 + enemyTime.s ? 'us' : 'enemy'
      };
      exportBattle(sessionBattle);
  };

  const clearAllData = () => {
      if (window.confirm("Are you sure you want to clear CURRENT session data? This will not delete saved history.")) {
          localStorage.removeItem('ourTime');
          localStorage.removeItem('enemyTime');
          localStorage.removeItem('remainingTime');
          localStorage.removeItem('castleOwner');
          localStorage.removeItem('rallyLeads');
          localStorage.removeItem('groups');
          localStorage.removeItem('battleLog');
          localStorage.removeItem('battleStartTime');
          localStorage.removeItem('lastTick');
          window.location.reload();
      }
  };

  // Import History
  const handleHistoryImportClick = () => {
      if (historyFileInputRef.current) historyFileInputRef.current.click();
  };

  const handleHistoryFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const imported = JSON.parse(evt.target.result);
              // Check if single battle object
              if (imported && imported.id && imported.logs && imported.finalOurTime) {
                  // Check for duplicates
                  if (savedBattles.some(b => b.id === imported.id)) {
                      alert("This battle is already in your history.");
                      return;
                  }
                  setSavedBattles(prev => [imported, ...prev]);
                  alert(`Successfully imported: ${imported.name}`);
              } else if (Array.isArray(imported)) {
                  alert("Invalid format: Please upload a single battle JSON file.");
              } else {
                  alert("Invalid file format.");
              }
          } catch (err) {
              console.error(err);
              alert("Error parsing JSON file.");
          }
      };
      reader.readAsText(file);
      e.target.value = null; // Reset
  };

  // CSV Import
  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      processCSV(text);
    };
    reader.readAsText(file);
    e.target.value = null; // Reset
  };

  const processCSV = (text) => {
    const lines = text.split(/\r?\n/);
    const newLeads = [];
    
    // Skip header row if it looks like a header (optional, simple check for 'side' or 'name')
    const startIdx = lines[0].toLowerCase().includes('side') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Only extract side and name
        const [rawSide, rawName] = line.split(',');
        if (!rawSide) continue;

        let side = 'us'; // default
        const s = rawSide.toLowerCase().trim();
        if (s === 'enemy' || s === 'them') side = 'enemy';
        
        const name = rawName ? rawName.trim() : `Lead ${i}`;
        const marchTime = 0; // Default to 0 as requested

        newLeads.push({
            id: Date.now() + i,
            side,
            name,
            marchTime,
            petExpiresAt: null,
            groupId: null
        });
    }

    setRallyLeads(prev => [...prev, ...newLeads]);
    addLog(`Imported ${newLeads.length} leads from CSV`, 'system');
  };

  const downloadTemplate = () => {
      // Updated template content: only side and name
      const csvContent = "data:text/csv;charset=utf-8,side,name\nus,PlayerName\nenemy,EnemyName";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "rally_leads_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };


  // --- Logic Effects ---

  // 1. Live Timer Ticker & Auto-Start Logic (Improved for Robustness)
  useEffect(() => {
    let interval = setInterval(() => {
      // 1a. Auto-Start Check & UTC Clock
      const now = Date.now();
      const nowDate = new Date();
      const timeString = nowDate.toISOString().split('T')[1].split('.')[0];
      setCurrentUtc(timeString);

      if (autoStartEnabled && !isTimerRunning) {
        // Handle potentially missing seconds in input (e.g., "12:00" vs "12:00:00")
        const target = autoStartTime.length === 5 ? autoStartTime + ":00" : autoStartTime;
        
        if (timeString === target) {
          setIsTimerRunning(true);
          setAutoStartEnabled(false);
          setBattleStartTime(now);
          setLastTick(now);
          addLog("Battle Auto-Started", 'system');
        }
      }

      // Handle Main Battle Timer logic
      if (isTimerRunning) {
         // Logic 1: Battle Countdown (fixed duration from start time)
         if (battleStartTime) {
             const elapsedSeconds = Math.floor((now - battleStartTime) / 1000);
             const totalSeconds = 5 * 60 * 60; // 5 hours
             let remaining = totalSeconds - elapsedSeconds;
             if (remaining < 0) remaining = 0;
             setRemainingTime(fromSeconds(remaining));
             
             if (remaining === 0) {
                 setIsTimerRunning(false); // Battle Over
                 addLog("Battle Ended (Time Expired)", 'system');
             }
         }

         // Logic 2: Occupation Accumulation (Delta based to handle crashes)
         if (lastTick > 0) {
             const delta = Math.floor((now - lastTick) / 1000);
             
             // Only process meaningful deltas (e.g. > 0s)
             if (delta > 0) {
                 if (castleOwner === 'us') {
                    setOurTime(prev => fromSeconds(toSeconds(prev) + delta));
                 } else if (castleOwner === 'enemy') {
                    setEnemyTime(prev => fromSeconds(toSeconds(prev) + delta));
                 }
                 // Update lastTick to now so we don't double count
                 setLastTick(now);
             }
         } else {
             // First tick or after reset
             setLastTick(now);
         }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, castleOwner, autoStartEnabled, autoStartTime, battleStartTime, lastTick, addLog]);

  // 2. Calculation Logic
  useEffect(() => {
    const ourSec = toSeconds(ourTime);
    const enemySec = toSeconds(enemyTime);
    const leftSec = toSeconds(remainingTime);

    const gap = Math.abs(ourSec - enemySec);
    const leader = ourSec > enemySec ? 'us' : (enemySec > ourSec ? 'enemy' : 'tie');
    
    const maxPossibleOurScore = ourSec + leftSec;
    const isWinImpossible = maxPossibleOurScore <= enemySec;
    
    const maxPossibleEnemyScore = enemySec + leftSec;
    const isLossImpossible = maxPossibleEnemyScore <= ourSec;

    let secondsNeededToWin = (enemySec - ourSec + leftSec) / 2 + 1;
    
    let status = 'contested';
    if (isWinImpossible) status = 'lost';
    if (isLossImpossible) status = 'won';
    
    let secondsUntilPointOfNoReturn = (ourSec + leftSec - enemySec) / 2;

    setResults({
      ourSec,
      enemySec,
      leftSec,
      gap,
      leader,
      status,
      secondsNeededToWin,
      secondsUntilPointOfNoReturn,
      maxPossibleOurScore
    });

  }, [ourTime, enemyTime, remainingTime]);

  // 3. Auto-Tracking Loop (Area Pattern Match)
  useEffect(() => {
    let animationFrameId;
    let frameCount = 0;

    const checkPattern = () => {
      if (isScreenShared && videoRef.current && canvasRef.current && targetPixel) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Ensure canvas matches video size
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Calculate Box Coordinates
        const centerX = Math.floor(targetPixel.x * canvas.width);
        const centerY = Math.floor(targetPixel.y * canvas.height);
        
        // Clamp to edges
        const startX = Math.max(0, centerX - Math.floor(scanSize / 2));
        const startY = Math.max(0, centerY - Math.floor(scanSize / 2));
        // Use scanSize, but don't overflow canvas
        const w = Math.min(scanSize, canvas.width - startX);
        const h = Math.min(scanSize, canvas.height - startY);

        // Get Pixel Data for the Region
        const currentImageData = ctx.getImageData(startX, startY, w, h).data;

        // Check triggers always for debug info
        if (hasUsPattern && hasEnemyPattern) {
            const distUs = calculatePatternDiff(currentImageData, usPatternRef.current);
            const distEnemy = calculatePatternDiff(currentImageData, enemyPatternRef.current);

            // Determine what the logic WOULD select
            let currentMatch = 'none';
            if (distUs < colorTolerance) currentMatch = 'us';
            else if (distEnemy < colorTolerance) currentMatch = 'enemy';

            // Update Debug info occasionally (every ~5 frames)
            if (frameCount % 5 === 0) {
              setDebugDiff({ us: Math.round(distUs), enemy: Math.round(distEnemy) });
              setDebugMatch(currentMatch);
            }

            // Only act if enabled
            if (autoTrackEnabled) {
              if (currentMatch === 'us') setCastleOwner('us');
              else if (currentMatch === 'enemy') setCastleOwner('enemy');
              else setCastleOwner('neutral');
            }
        }
        frameCount++;
      }
      animationFrameId = requestAnimationFrame(checkPattern);
    };

    if (isScreenShared) {
      checkPattern();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isScreenShared, targetPixel, autoTrackEnabled, hasUsPattern, hasEnemyPattern, colorTolerance, scanSize]);

  // 4. Pet Expiration Check Logic
  useEffect(() => {
    const interval = setInterval(() => {
        const now = Date.now();
        setRallyLeads(prevLeads => {
            let hasUpdates = false;
            const newLeads = prevLeads.map(lead => {
                if (lead.petExpiresAt && lead.petExpiresAt <= now && !lead.expirationLogged) {
                    addLog(`Pet expired for ${lead.name || 'Unnamed Lead'}`, 'pet', lead.side);
                    hasUpdates = true;
                    return { ...lead, expirationLogged: true };
                }
                return lead;
            });
            return hasUpdates ? newLeads : prevLeads;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [addLog]);


  // --- Screen Capture Handlers ---

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScreenShared(true);
      }
      
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenShared(false);
        setAutoTrackEnabled(false);
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const handleVideoClick = (e) => {
    if (!videoRef.current) return;
    
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setTargetPixel({ x, y });
  };

  const capturePattern = (type) => {
     if (!videoRef.current || !canvasRef.current || !targetPixel) return;
     
     const canvas = canvasRef.current;
     const ctx = canvas.getContext('2d', { willReadFrequently: true });
     
     const centerX = Math.floor(targetPixel.x * canvas.width);
     const centerY = Math.floor(targetPixel.y * canvas.height);
     const startX = Math.max(0, centerX - Math.floor(scanSize / 2));
     const startY = Math.max(0, centerY - Math.floor(scanSize / 2));
     const w = Math.min(scanSize, canvas.width - startX);
     const h = Math.min(scanSize, canvas.height - startY);

     // Copy data to a Float32Array or standard array isn't needed, Uint8ClampedArray is fine
     const imageData = ctx.getImageData(startX, startY, w, h).data;
     
     // We must clone it because ImageData.data is a view on the canvas buffer which changes
     const dataClone = new Uint8ClampedArray(imageData);

     if (type === 'us') {
         usPatternRef.current = dataClone;
         setHasUsPattern(true);
     } else {
         enemyPatternRef.current = dataClone;
         setHasEnemyPattern(true);
     }
  };

  // --- UI Helpers ---

  const getStatusColor = () => {
    if (!results) return 'bg-slate-800';
    if (results.status === 'won') return 'bg-green-900 border-green-500';
    if (results.status === 'lost') return 'bg-red-900 border-red-500';
    return 'bg-slate-800 border-slate-600';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6">
        
        {/* Main Tab Navigation */}
        <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-700 w-full mb-4 overflow-x-auto">
           <button onClick={() => setCurrentTab('calculator')} className={`flex-1 py-3 px-2 rounded-md font-bold text-[10px] md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-all min-w-[80px] ${currentTab === 'calculator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><Calculator size={16} /> BATTLE CALCULATOR</button>
           <button onClick={() => setCurrentTab('rallies')} className={`flex-1 py-3 px-2 rounded-md font-bold text-[10px] md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-all min-w-[80px] ${currentTab === 'rallies' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><LayoutList size={16} /> RALLY MANAGER</button>
           <button onClick={() => setCurrentTab('grouping')} className={`flex-1 py-3 px-2 rounded-md font-bold text-[10px] md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-all min-w-[80px] ${currentTab === 'grouping' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><Users size={16} /> RALLY GROUPS</button>
           <button onClick={() => setCurrentTab('records')} className={`flex-1 py-3 px-2 rounded-md font-bold text-[10px] md:text-sm flex items-center justify-center gap-1 md:gap-2 transition-all min-w-[80px] ${currentTab === 'records' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><BookOpen size={16} /> RECORDS</button>
        </div>

        {/* =======================
            CALCULATOR TAB 
           ======================= */}
        {currentTab === 'calculator' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                  War Calculator
                </h1>
                <p className="text-slate-400 text-xs">Castle Occupation Strategy</p>
              </div>
            </div>

            {/* LIVE MODE: Controls & Screen */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
              
              {/* Left Column: Video & Controls (Span 2) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Screen Capture Section */}
                <div className="bg-black rounded-xl border border-slate-700 overflow-hidden relative group aspect-video flex items-center justify-center">
                  {/* Overlay when no screen */}
                  {!isScreenShared && (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <Monitor size={48} className="text-slate-600 mb-4" />
                      <p className="text-slate-400 mb-4">Attach the game window to enable tracking.</p>
                      <button 
                        onClick={startScreenShare}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold border border-slate-600 transition-all"
                      >
                        <Eye size={16} /> Select Game Screen
                      </button>
                    </div>
                  )}
                  
                  {/* Video Player */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    onClick={handleVideoClick}
                    className={`w-full h-full object-contain cursor-crosshair ${isScreenShared ? 'block' : 'hidden'}`}
                  />
                  
                  {/* Hidden Canvas for Processing */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Target Pixel Indicator (Box) */}
                  {isScreenShared && targetPixel && (
                    <div 
                        className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 border-2 border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] z-10"
                        style={{ 
                            left: `${targetPixel.x * 100}%`, 
                            top: `${targetPixel.y * 100}%`,
                            width: `${scanSize}px`,
                            height: `${scanSize}px`
                        }}
                    >
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-[10px] text-green-400 px-1 rounded whitespace-nowrap">
                            SCAN AREA
                        </div>
                    </div>
                  )}
                </div>

                {/* Master Timer & Auto-Start Control */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col gap-4">
                  
                  {/* Main Play Button */}
                  <div className="flex gap-2">
                      <button 
                          onClick={() => {
                            const nextState = !isTimerRunning;
                            setIsTimerRunning(nextState);
                            if(nextState && !battleStartTime) {
                                // First start
                                const now = Date.now();
                                setBattleStartTime(now);
                                setLastTick(now);
                            }
                            addLog(nextState ? "Battle Timer Started" : "Battle Timer Paused", 'system');
                          }}
                          className={`flex-1 py-3 rounded-lg font-black text-lg flex items-center justify-center gap-2 transition-all ${isTimerRunning ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500/20'}`}
                      >
                          {isTimerRunning ? <><Pause size={20}/> PAUSE</> : <><Play size={20}/> START</>}
                      </button>

                      {/* Reset Button */}
                      <button 
                          onClick={resetBattle}
                          className="px-4 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                          title="Reset Battle Timer"
                      >
                          <RotateCcw size={24} />
                      </button>
                  </div>

                  {/* Auto-Start Configuration */}
                  <div className="w-full flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                          <span className="text-xs text-slate-500 font-bold uppercase">Auto-Start (UTC)</span>
                          <div className="flex items-center gap-2 mt-1">
                              <Clock size={14} className="text-indigo-400"/>
                              <span className="text-sm font-mono text-slate-300">{currentUtc || "00:00:00"} (UTC)</span>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <input 
                              type="time" 
                              step="1" 
                              value={autoStartTime}
                              onChange={(e) => setAutoStartTime(e.target.value)}
                              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-indigo-500 text-white"
                              disabled={autoStartEnabled || isTimerRunning}
                          />
                          <button
                              onClick={() => {
                                setAutoStartEnabled(!autoStartEnabled);
                                addLog(!autoStartEnabled ? `Auto-Start Armed for ${autoStartTime}` : "Auto-Start Disarmed", 'system');
                              }}
                              disabled={isTimerRunning}
                              className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                                  autoStartEnabled 
                                  ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.5)]' 
                                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                              }`}
                          >
                              {autoStartEnabled ? 'ARMED' : 'ENABLE'}
                          </button>
                      </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Automation Config */}
              <div className="space-y-4">
                
                {/* Manual Override */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Current Control</span>
                  <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => { setCastleOwner('us'); setAutoTrackEnabled(false); }}
                        className={`px-3 py-2 rounded-lg font-bold text-sm transition-all border ${castleOwner === 'us' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        WE OCCUPY
                      </button>
                      <button 
                        onClick={() => { setCastleOwner('neutral'); setAutoTrackEnabled(false); }}
                        className={`px-3 py-2 rounded-lg font-bold text-sm transition-all border ${castleOwner === 'neutral' ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        NOBODY
                      </button>
                      <button 
                        onClick={() => { setCastleOwner('enemy'); setAutoTrackEnabled(false); }}
                        className={`px-3 py-2 rounded-lg font-bold text-sm transition-all border ${castleOwner === 'enemy' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        ENEMY OCCUPIES
                      </button>
                  </div>
                </div>

                {/* Auto Tracker Setup */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                    <Settings size={16} className="text-indigo-400"/>
                    <span className="text-xs font-bold uppercase text-slate-300">Auto-Tracker Setup</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    
                    {/* Scan Size Control */}
                    <div className="bg-black/20 p-2 rounded border border-white/5 mb-2">
                        <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                            <span className="flex items-center gap-1"><Maximize size={12}/> Scan Box Size</span>
                            <span className="font-mono text-indigo-300">{scanSize}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="10" 
                            max="150" 
                            value={scanSize} 
                            onChange={(e) => setScanSize(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    <p className="text-xs text-slate-500">1. Click video to place Scan Box.</p>
                    
                    <p className="text-xs text-slate-500 pt-2">2. Capture current area visual:</p>
                    
                    <button 
                        onClick={() => capturePattern('us')}
                        disabled={!targetPixel}
                        className="w-full flex justify-between items-center px-3 py-2 bg-blue-900/20 border border-blue-500/30 rounded hover:bg-blue-900/40 disabled:opacity-50"
                    >
                        <span className="text-blue-300 font-bold">Capture Area as OURS</span>
                        <div className="flex items-center gap-2">
                          {debugDiff.us !== null && <span className="text-[10px] font-mono text-slate-400">Diff:{debugDiff.us}</span>}
                          {hasUsPattern && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_cyan]"/>}
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => capturePattern('enemy')}
                        disabled={!targetPixel}
                        className="w-full flex justify-between items-center px-3 py-2 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-900/40 disabled:opacity-50"
                    >
                        <span className="text-red-300 font-bold">Capture Area as ENEMY</span>
                        <div className="flex items-center gap-2">
                          {debugDiff.enemy !== null && <span className="text-[10px] font-mono text-slate-400">Diff:{debugDiff.enemy}</span>}
                          {hasEnemyPattern && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_orange]"/>}
                        </div>
                    </button>

                    <div className="pt-2 border-t border-white/10 mt-2">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                          <span>Pattern Match Tolerance</span>
                          <span className="font-mono text-indigo-300">{colorTolerance}</span>
                      </div>
                      <input 
                          type="range" 
                          min="5" 
                          max="100" 
                          value={colorTolerance} 
                          onChange={(e) => setColorTolerance(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-3 accent-indigo-500"
                          title="Increase if status stays on Neutral"
                      />
                      
                      <div className="text-center mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${debugMatch === 'us' ? 'bg-blue-900 text-blue-200' : debugMatch === 'enemy' ? 'bg-red-900 text-red-200' : 'bg-slate-800 text-slate-400'}`}>
                              MATCH: {debugMatch === 'us' ? 'WE OCCUPY' : debugMatch === 'enemy' ? 'ENEMY' : 'NOBODY'}
                          </span>
                      </div>

                      <button 
                          onClick={() => setAutoTrackEnabled(!autoTrackEnabled)}
                          disabled={!hasUsPattern || !hasEnemyPattern}
                          className={`w-full py-2 rounded font-bold text-center transition-all ${autoTrackEnabled ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}
                      >
                          {autoTrackEnabled ? 'AUTO-TRACKING ON' : 'ENABLE AUTO-TRACK'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Inputs Display (ReadOnly in Live Mode) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TimeInput 
                label={<><Shield size={16} className="text-blue-400"/> Our Occupation</>} 
                value={ourTime} 
                onChange={setOurTime} 
                colorClass="bg-blue-500 border-blue-400"
                readOnly={true}
              />
              <TimeInput 
                label={<><Swords size={16} className="text-red-400"/> Enemy Occupation</>} 
                value={enemyTime} 
                onChange={setEnemyTime} 
                colorClass="bg-red-500 border-red-400"
                readOnly={true}
              />
            </div>

            <div className="w-full">
              <TimeInput 
                label={<><Hourglass size={16} className="text-amber-400"/> Battle Time Remaining</>} 
                value={remainingTime} 
                onChange={setRemainingTime} 
                colorClass="bg-amber-500 border-amber-400"
                readOnly={true}
              />
            </div>

            {/* Results Section */}
            {results && (
              <div className={`rounded-2xl border-2 p-6 transition-all duration-300 shadow-2xl ${getStatusColor()}`}>
                
                {/* Status Header */}
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <span className="text-lg font-bold uppercase tracking-widest opacity-80">Battle Status</span>
                  <div className="text-xl font-black uppercase flex items-center gap-2">
                    {results.status === 'won' && <><CheckCircle className="text-green-400"/> Victory Secure</>}
                    {results.status === 'lost' && <><AlertTriangle className="text-red-400"/> Defeat Imminent</>}
                    {results.status === 'contested' && <><Swords className="text-yellow-400"/> Contested</>}
                  </div>
                </div>

                {/* Live Visual Timeline (NEW) */}
                {battleLog.length > 0 && (
                   <div className="mb-6 p-4 border-b border-white/10 bg-slate-900/30 rounded-lg">
                       <VisualTimeline logs={[...battleLog, { 
                           id: Date.now(), 
                           timestamp: new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC', 
                           type: 'current',
                           message: 'Now',
                           side: 'neutral'
                       }]} />
                   </div>
                )}

                {/* Victory Requirement Card */}
                {results.status === 'contested' && (
                  <div className="space-y-6">
                    
                    {/* How much time needed */}
                    <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-blue-300 font-bold mb-1">Occupation Needed to Win</h3>
                          <p className="text-xs text-slate-400 max-w-[250px]">
                            You must hold the castle for this total cumulative duration (starting now) to guarantee a win.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-mono font-bold text-blue-400 block">
                            {formatMinSec(results.secondsNeededToWin)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Point of No Return */}
                    <div className="bg-red-950/30 p-4 rounded-lg border border-red-500/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-red-300 font-bold mb-1 flex items-center gap-2">
                            <Clock size={16}/> Point of No Return
                          </h3>
                          <p className="text-xs text-slate-400 max-w-[250px]">
                            If the enemy holds the castle continuously from now, you will lose the mathematical possibility to win in:
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-mono font-bold text-red-400 block">
                            {results.secondsUntilPointOfNoReturn > 0 
                              ? formatMinSec(results.secondsUntilPointOfNoReturn) 
                              : "NOW"}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Already Won/Lost Messages */}
                {results.status === 'won' && (
                  <div className="text-center py-4">
                    <p className="text-green-200">Victory is mathematically guaranteed.</p>
                  </div>
                )}
                {results.status === 'lost' && (
                  <div className="text-center py-4">
                    <p className="text-red-200">Victory is mathematically impossible.</p>
                  </div>
                )}

                {/* Simple Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase">Current Gap</p>
                    <p className={`font-mono text-lg font-bold ${results.leader === 'us' ? 'text-green-400' : 'text-red-400'}`}>
                      {results.leader === 'us' ? '+' : '-'}{formatMinSec(results.gap)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase">Total Event Time</p>
                    <p className="font-mono text-lg font-bold text-slate-300">5h 00m 00s</p>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* =======================
            RALLY MANAGER TAB 
           ======================= */}
        {currentTab === 'rallies' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             
             {/* Header with Import Button */}
             <div className="flex justify-between items-center mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                   <h2 className="text-lg font-bold text-slate-200">Rally Management</h2>
                   <button 
                      onClick={downloadTemplate}
                      className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1 border border-slate-700 hover:border-indigo-500 px-2 py-1 rounded transition-colors"
                      title="Download CSV Template"
                   >
                      <FileDown size={14} /> Template
                   </button>
                </div>
                
                <div className="flex items-center gap-2">
                   <input 
                      type="file" 
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                   />
                   <button 
                      onClick={handleImportClick}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-900/20"
                   >
                      <Upload size={14} /> Import CSV
                   </button>
                </div>
             </div>

             {/* --- LISTS SECTION --- */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Our Column */}
                <div className="bg-black/20 rounded-xl p-4 border border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-blue-500/30 pb-3">
                      <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                          <Shield className="fill-blue-500/20"/> OUR RALLIES
                      </h2>
                      <button 
                          onClick={() => addRallyLead('us')}
                          className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md transition-colors"
                      >
                          <Plus size={20} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {rallyLeads.filter(l => l.side === 'us').map(lead => (
                          <RallyLeadCard 
                            key={lead.id} 
                            lead={lead} 
                            onUpdate={updateRallyLead} 
                            onDelete={deleteRallyLead}
                          />
                      ))}
                      {rallyLeads.filter(l => l.side === 'us').length === 0 && (
                          <div className="text-slate-600 text-center py-8 text-sm italic">
                            No rally leads added.
                          </div>
                      )}
                    </div>
                </div>

                {/* Enemy Column */}
                <div className="bg-black/20 rounded-xl p-4 border border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
                      <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                          <Swords className="fill-red-500/20"/> ENEMY RALLIES
                      </h2>
                      <button 
                          onClick={() => addRallyLead('enemy')}
                          className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-md transition-colors"
                      >
                          <Plus size={20} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {rallyLeads.filter(l => l.side === 'enemy').map(lead => (
                          <RallyLeadCard 
                            key={lead.id} 
                            lead={lead} 
                            onUpdate={updateRallyLead} 
                            onDelete={deleteRallyLead}
                          />
                      ))}
                      {rallyLeads.filter(l => l.side === 'enemy').length === 0 && (
                          <div className="text-slate-600 text-center py-8 text-sm italic">
                            No enemy rally leads added.
                          </div>
                      )}
                    </div>
                </div>
             </div>

          </div>
        )}

        {/* =======================
            GROUPING TAB 
           ======================= */}
        {currentTab === 'grouping' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
             
             {/* Our Groups */}
             <div className="bg-black/20 rounded-xl p-4 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-blue-500/30 pb-3">
                   <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                      <Shield className="fill-blue-500/20"/> OUR GROUPS
                   </h2>
                   <button 
                      onClick={() => addGroup('us')}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md transition-colors"
                      title="Add New Group"
                   >
                      <Plus size={16} />
                   </button>
                </div>
                
                <div className="flex flex-col gap-4">
                   {groups.filter(g => g.side === 'us').map(group => (
                      <RallyGroupCard 
                        key={group.id} 
                        group={group} 
                        members={rallyLeads.filter(l => l.groupId === group.id)}
                        availableLeads={rallyLeads.filter(l => l.side === 'us' && !l.groupId)}
                        onAssign={assignLeadToGroup}
                        onRemove={removeLeadFromGroup}
                        onActivatePet={handleActivatePetFromGroup}
                        onDelete={deleteGroup}
                        onUpdate={updateRallyLead}
                      />
                   ))}
                </div>
             </div>

             {/* Enemy Groups */}
             <div className="bg-black/20 rounded-xl p-4 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
                   <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                      <Swords className="fill-red-500/20"/> ENEMY GROUPS
                   </h2>
                   <button 
                      onClick={() => addGroup('enemy')}
                      className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-md transition-colors"
                      title="Add New Group"
                   >
                      <Plus size={16} />
                   </button>
                </div>
                
                <div className="flex flex-col gap-4">
                   {groups.filter(g => g.side === 'enemy').map(group => (
                      <RallyGroupCard 
                        key={group.id} 
                        group={group} 
                        members={rallyLeads.filter(l => l.groupId === group.id)}
                        availableLeads={rallyLeads.filter(l => l.side === 'enemy' && !l.groupId)}
                        onAssign={assignLeadToGroup}
                        onRemove={removeLeadFromGroup}
                        onActivatePet={handleActivatePetFromGroup}
                        onDelete={deleteGroup}
                        onUpdate={updateRallyLead}
                      />
                   ))}
                </div>
             </div>

          </div>
        )}

        {/* =======================
            RECORDS TAB (Merged Logs & History)
           ======================= */}
        {currentTab === 'records' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             
             {/* Sub-Navigation for Records */}
             <div className="flex justify-center mb-2">
                 <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex gap-1">
                    <button 
                        onClick={() => setRecordsView('current')} 
                        className={`px-4 py-2 rounded text-sm font-bold transition-all ${recordsView === 'current' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Current Session Log
                    </button>
                    <button 
                        onClick={() => setRecordsView('history')} 
                        className={`px-4 py-2 rounded text-sm font-bold transition-all ${recordsView === 'history' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Saved History
                    </button>
                 </div>
             </div>

             {/* === CURRENT SESSION VIEW === */}
             {recordsView === 'current' && (
                 <>
                     <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        {/* Save Controls */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center border-b border-white/10 pb-4 mb-2">
                           <div className="flex-1 w-full">
                               <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Battle Name</label>
                               <div className="flex gap-2">
                                   <input 
                                      type="text" 
                                      value={battleName}
                                      onChange={(e) => setBattleName(e.target.value)}
                                      placeholder="e.g. 1611 vs 1513"
                                      className="bg-black/40 border border-slate-600 rounded px-3 py-2 text-sm text-white w-full focus:border-indigo-500 outline-none"
                                   />
                                   <button 
                                      onClick={saveBattleLog}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap"
                                   >
                                      <Save size={16} /> Save History
                                   </button>
                               </div>
                           </div>
                           <div className="flex items-end gap-2">
                               <button 
                                   onClick={exportCurrentSession}
                                   className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-3 py-2 rounded text-xs font-bold transition-all flex items-center gap-2"
                                   title="Download current session as JSON"
                                >
                                   <Download size={16} /> Export Session
                                </button>
                               <button 
                                   onClick={clearAllData}
                                   className="bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50 px-3 py-2 rounded text-xs font-bold transition-all flex items-center gap-2"
                                >
                                   <Trash2 size={16} /> Clear Session
                                </button>
                           </div>
                        </div>

                        <div className="flex items-center gap-2 text-lg font-bold text-slate-200">
                           <History size={20} className="text-slate-400"/> Live Activity Feed
                        </div>
                     </div>

                     <div className="bg-black/20 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                           {battleLog.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {battleLog.map((log) => (
                                   <div key={log.id} className={`flex gap-3 p-3 rounded border-l-4 ${
                                       log.type === 'victory' ? 'bg-amber-900/20 border-amber-500' :
                                       log.type === 'occupation' ? 'bg-indigo-900/20 border-indigo-500' :
                                       log.type === 'pet' ? 'bg-emerald-900/20 border-emerald-500' :
                                       'bg-slate-900/40 border-slate-600'
                                   }`}>
                                      <span className="text-xs font-mono text-slate-500 whitespace-nowrap pt-0.5">{log.timestamp}</span>
                                      <span className="text-sm text-slate-300">{log.message}</span>
                                   </div>
                                ))}
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                                 <History size={48} className="mb-2 opacity-20"/>
                                 <p className="text-sm">No activity recorded yet.</p>
                              </div>
                           )}
                        </div>
                     </div>
                 </>
             )}

             {/* === SAVED HISTORY VIEW === */}
             {recordsView === 'history' && (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                     {/* Left Sidebar: Battle List */}
                     <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden flex flex-col md:col-span-1">
                        <div className="p-3 bg-slate-900 flex flex-col gap-2 border-b border-slate-800">
                           <div className="flex justify-between items-center font-bold text-slate-400 text-sm">
                               <span>SAVED BATTLES</span>
                               <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">{savedBattles.length}</span>
                           </div>
                           <div className="flex gap-2">
                                <button 
                                    onClick={handleHistoryImportClick} 
                                    className="flex-1 bg-slate-800 hover:bg-indigo-900/50 text-slate-300 text-[10px] font-bold py-1.5 rounded border border-slate-700 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                                >
                                    <Upload size={12} /> Import JSON
                                </button>
                                <input 
                                    type="file" 
                                    accept=".json"
                                    ref={historyFileInputRef}
                                    onChange={handleHistoryFileChange}
                                    className="hidden"
                                />
                           </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                           {savedBattles.length === 0 && <div className="text-center text-slate-600 text-xs py-8">No saved battles.</div>}
                           {savedBattles.map(battle => (
                              <div 
                                key={battle.id} 
                                className={`p-3 rounded cursor-pointer group relative border transition-all ${
                                    selectedBattle && selectedBattle.id === battle.id 
                                    ? 'bg-slate-700 border-indigo-500' 
                                    : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600'
                                }`}
                                onClick={() => setSelectedBattle(battle)}
                              >
                                 <div className="flex justify-between items-start">
                                    <div>
                                       <h4 className="font-bold text-slate-200 text-sm truncate max-w-[150px]">{battle.name}</h4>
                                       <p className="text-[10px] text-slate-500 mt-1">{new Date(battle.date).toLocaleDateString()}</p>
                                    </div>
                                    {battle.winner === 'us' 
                                       ? <span className="text-[10px] font-bold text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/50">WIN</span>
                                       : <span className="text-[10px] font-bold text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-900/50">LOSS</span>
                                    }
                                 </div>
                                 <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); exportBattle(battle); }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-900 rounded border border-slate-700 hover:border-indigo-500"
                                        title="Download JSON"
                                     >
                                        <Download size={12} />
                                     </button>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); deleteSavedBattle(battle.id); }}
                                        className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 rounded border border-slate-700 hover:border-red-500"
                                        title="Delete"
                                     >
                                        <Trash2 size={12} />
                                     </button>
                                 </div>
                                 
                                 <div className="mt-3 pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="text-center">
                                       <span className="text-slate-500 block">OUR TIME</span>
                                       <span className="font-mono text-blue-400">{formatMinSec(toSeconds(battle.finalOurTime))}</span>
                                    </div>
                                    <div className="text-center">
                                       <span className="text-slate-500 block">ENEMY TIME</span>
                                       <span className="font-mono text-red-400">{formatMinSec(toSeconds(battle.finalEnemyTime))}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Right Content: Detailed View */}
                     <div className="bg-black/20 rounded-xl border border-slate-800 md:col-span-2 overflow-y-auto custom-scrollbar flex flex-col relative">
                        {selectedBattle ? (
                            <div className="flex flex-col min-h-full">
                                <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-lg sticky top-0 z-20">
                                   <div>
                                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                         {selectedBattle.name}
                                         {selectedBattle.winner === 'us' ? <Trophy className="text-yellow-500" size={20}/> : <Skull className="text-slate-500" size={20}/>}
                                      </h2>
                                      <p className="text-xs text-slate-500 font-mono mt-1">Recorded: {new Date(selectedBattle.date).toUTCString()}</p>
                                   </div>
                                   <div className="text-right">
                                      <span className={`text-2xl font-black ${selectedBattle.winner === 'us' ? 'text-green-400' : 'text-red-500'}`}>
                                         {selectedBattle.winner === 'us' ? 'VICTORY' : 'DEFEAT'}
                                      </span>
                                   </div>
                                </div>
                                
                                <div className="p-4 border-b border-white/5 bg-slate-900/30">
                                   <VisualTimeline logs={selectedBattle.logs} />
                                </div>

                                <div className="grid grid-cols-2 gap-4 p-4 border-b border-white/5 bg-slate-900/30">
                                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                        <span className="text-xs text-blue-400 font-bold uppercase block mb-1">Our Occupation</span>
                                        <span className="text-2xl font-mono text-white">{formatMinSec(toSeconds(selectedBattle.finalOurTime))}</span>
                                    </div>
                                    <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3 text-center">
                                        <span className="text-xs text-red-400 font-bold uppercase block mb-1">Enemy Occupation</span>
                                        <span className="text-2xl font-mono text-white">{formatMinSec(toSeconds(selectedBattle.finalEnemyTime))}</span>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 pb-12">
                                   <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Event Timeline</h3>
                                   <div className="space-y-4 relative pl-4 border-l-2 border-slate-800 ml-2">
                                      {selectedBattle.logs.filter(l => ['occupation', 'pet', 'victory'].includes(l.type)).map((log, idx) => (
                                         <div key={idx} className="relative pl-6">
                                            <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${
                                                log.type === 'victory' ? 'bg-yellow-500 border-yellow-300' :
                                                log.type === 'occupation' ? 'bg-indigo-500 border-indigo-300' :
                                                'bg-emerald-500 border-emerald-300'
                                            }`}></div>
                                            <div className="flex flex-col">
                                               <span className="text-[10px] font-mono text-slate-500 mb-0.5">{log.timestamp.split(' ')[1]} (UTC)</span>
                                               <span className={`text-sm ${
                                                   log.type === 'victory' ? 'text-yellow-400 font-bold' :
                                                   log.type === 'occupation' ? 'text-white' :
                                                   'text-emerald-300'
                                               }`}>
                                                  {log.message}
                                               </span>
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                <Archive size={64} className="mb-4 opacity-20"/>
                                <p>Select a battle from the left to view details</p>
                            </div>
                        )}
                     </div>
                 </div>
             )}

          </div>
        )}

      </div>
    </div>
  );
};

export default App;