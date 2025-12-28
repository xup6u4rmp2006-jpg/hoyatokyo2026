import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TEAM_MEMBERS, PRIDE_COLORS, MEMBER_PHOTOS } from '../constants';
import { RotateCw, Bed, Shuffle, Sparkles, Coins, Ghost, Car, Users, Lock, Unlock, X, Check, Pin, Zap, Star, AlertCircle, Trash2, ArrowLeft, Gift } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

type RaffleTab = 'wheel' | 'beds' | 'cars';
type GachaStatus = 'waiting-coin' | 'ready-to-crank' | 'cranking' | 'capsule-out' | 'opening' | 'finished';

interface RaffleProps {
  onModalToggle?: (isOpen: boolean) => void;
}

const WHEEL_MEMBERS = TEAM_MEMBERS;
const RAFFLE_MEMBERS = ['Sean', 'Wilson', 'Ben', 'Ethan', 'Oedi', 'William', 'Alvin', 'Sophia', 'Daisy', 'Nica'];

const UPPER_TITLES = ['🛸 未來感頂艙', '🌈 彩虹夢境位', '☁️ 雲端景觀首選', '🎨 藝術家上舖', '🌟 璀璨星空位'];
const LOWER_TITLES = ['🍦 甜心下舖', '📖 寧靜閱讀區', '🛌 懶人極致舒適', '🍫 巧克力醇厚位', '🦄 獨角獸窩窩'];
const ALL_BED_IDS = ['U1', 'U2', 'U3', 'U4', 'U5', 'L1', 'L2', 'L3', 'L4', 'L5'];

const BED_COLORS: Record<string, string> = {
  'U1': 'from-blue-400 to-indigo-500', 'U2': 'from-purple-400 to-pink-500', 'U3': 'from-yellow-400 to-orange-500',
  'U4': 'from-pink-400 to-rose-500', 'U5': 'from-cyan-400 to-blue-500', 'L1': 'from-green-400 to-emerald-500',
  'L2': 'from-amber-400 to-yellow-600', 'L3': 'from-indigo-400 to-purple-600', 'L4': 'from-orange-400 to-red-500',
  'L5': 'from-fuchsia-400 to-purple-500'
};

interface BedResult {
  bedId: string;
  member: string;
  title: string;
}

const MemberBadge: React.FC<{ name: string; size?: string; className?: string; textScale?: string; customPhoto?: string; isShuffling?: boolean }> = ({ name, size = "w-10 h-10", className = "", textScale = "text-xs", customPhoto, isShuffling }) => {
  const index = TEAM_MEMBERS.indexOf(name);
  const bgColor = PRIDE_COLORS[index !== -1 ? index % PRIDE_COLORS.length : 0];
  const photoUrl = customPhoto || MEMBER_PHOTOS[name];

  return (
    <div className={`relative flex-shrink-0 rounded-full transition-all duration-300 ${size} ${className} ${isShuffling ? 'animate-shuffle-pop opacity-70' : ''}`}>
      {photoUrl ? (
        <div className="w-full h-full rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`w-full h-full rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-black uppercase ${textScale} ${bgColor}`}>
          {name[0]}
        </div>
      )}
    </div>
  );
};

const Raffle: React.FC<RaffleProps> = ({ onModalToggle }) => {
  const [activeTab, setActiveTab] = useState<RaffleTab>('wheel');
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // 扭蛋狀態
  const [gachaStatus, setGachaStatus] = useState<GachaStatus>('waiting-coin');
  const [preCalculatedBeds, setPreCalculatedBeds] = useState<BedResult[]>([]);
  const [results, setResults] = useState<BedResult[]>([]);
  const [capsuleColor, setCapsuleColor] = useState('#FFADAD');
  const [shakeMachine, setShakeMachine] = useState(false);
  const [openingResult, setOpeningResult] = useState<BedResult | null>(null);
  const [capsuleStage, setCapsuleStage] = useState<'idle' | 'shaking' | 'popping' | 'revealing'>('idle');
  
  const [fixedSeats, setFixedSeats] = useState<Record<string, 'car4' | 'car6' | null>>({});
  const [fixedBeds, setFixedBeds] = useState<Record<string, string | null>>({});
  const [carResults, setCarResults] = useState<{ car4: string[], car6: string[] } | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, any>>({});
  const [isCarShuffling, setIsCarShuffling] = useState(false);

  const [isEditMode, setIsEditMode] = useState<'none' | 'cars' | 'beds'>('none');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const macaronRainbowGradient = "linear-gradient(45deg, #FF8A8A, #FFB347, #FBC02D, #D4E157, #66BB6A, #4DD0E1, #5C6BC0, #9575CD, #F06292, #FF7043)";

  useEffect(() => {
    onModalToggle?.(showWinnerModal || showPasswordModal || isEditMode !== 'none' || showResetConfirm || openingResult !== null);
  }, [showWinnerModal, showPasswordModal, isEditMode, showResetConfirm, openingResult, onModalToggle]);

  const generateValidMapping = useCallback((currentFixed = fixedBeds) => {
    const checkConstraint = (mapping: BedResult[]) => {
      const grid: Record<string, string> = {};
      mapping.forEach(m => { grid[m.bedId] = m.member; });
      const layout = [['U1', 'U2', 'U3', 'U4', 'U5'], ['L1', 'L2', 'L3', 'L4', 'L5']];
      let nPos = { r: -1, c: -1 }, ePos = { r: -1, c: -1 };
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 5; c++) {
          if (grid[layout[r][c]] === 'Nica') nPos = { r, c };
          if (grid[layout[r][c]] === 'Ethan') ePos = { r, c };
        }
      }
      if (nPos.r === -1 || ePos.r === -1) return true;
      const rDiff = Math.abs(nPos.r - ePos.r), cDiff = Math.abs(nPos.c - ePos.c);
      return !((rDiff === 1 && cDiff === 0) || (rDiff === 0 && cDiff === 1));
    };

    let valid = false, finalMapping: BedResult[] = [], attempts = 0;
    while (!valid && attempts < 150) {
      attempts++;
      const mapping: BedResult[] = [], assignedMembers = new Set<string>(), assignedBeds = new Set<string>();
      Object.entries(currentFixed).forEach(([member, bedId]) => {
        if (bedId) {
          const bId = bedId as string;
          const idx = parseInt(bId[1]) - 1;
          mapping.push({ bedId: bId, member, title: bId.startsWith('U') ? UPPER_TITLES[idx] : LOWER_TITLES[idx] });
          assignedMembers.add(member); assignedBeds.add(bId);
        }
      });
      const remMembers = RAFFLE_MEMBERS.filter(m => !assignedMembers.has(m)).sort(() => Math.random() - 0.5);
      const remBeds = ALL_BED_IDS.filter(b => !assignedBeds.has(b)).sort(() => Math.random() - 0.5);
      remBeds.forEach((bid, i) => {
        const m = remMembers[i];
        if (m) {
          const idx = parseInt(bid[1]) - 1;
          mapping.push({ bedId: bid, member: m, title: bid.startsWith('U') ? UPPER_TITLES[idx] : LOWER_TITLES[idx] });
        }
      });
      finalMapping = mapping;
      if (finalMapping.length === 10) {
        valid = checkConstraint(finalMapping);
      }
    }
    return valid ? finalMapping : [];
  }, [fixedBeds]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "travelData", "raffle"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFixedSeats(data.fixedSeats || {});
        setFixedBeds(data.fixedBeds || {});
        if (data.carResults) setCarResults(data.carResults);
      }
    });

    const unsubProfiles = onSnapshot(doc(db, "travelData", "memberProfiles"), (docSnap) => {
      if (docSnap.exists()) setMemberProfiles(docSnap.data());
    });

    return () => { unsub(); unsubProfiles(); };
  }, []);

  const handleResetBeds = async () => {
    setShowResetConfirm(false);
    setResults([]);
    setGachaStatus('waiting-coin');
    setShakeMachine(true);
    setTimeout(() => {
      const fresh = generateValidMapping();
      setPreCalculatedBeds(fresh);
      setShakeMachine(false);
    }, 300);
  };

  const handleDrawAll = () => {
    if (results.length >= 10 || gachaStatus === 'cranking') return;
    let mapping = preCalculatedBeds;
    if (mapping.length === 0) {
      mapping = generateValidMapping();
      setPreCalculatedBeds(mapping);
    }
    if (mapping.length === 0) {
      alert("⚠️ 無法產生合法佈局，請檢查固定位設定。");
      return;
    }
    setShakeMachine(true);
    setGachaStatus('cranking');
    setTimeout(() => {
      setResults(mapping);
      setGachaStatus('finished');
      setShakeMachine(false);
    }, 1200);
  };

  const handleCrank = () => {
    if (gachaStatus !== 'ready-to-crank' || results.length >= 10) return;
    let mapping = preCalculatedBeds;
    if (mapping.length === 0) {
      mapping = generateValidMapping();
      setPreCalculatedBeds(mapping);
    }
    if (mapping.length === 0) {
      alert("⚠️ 無法產生合法佈局，請檢查固定位設定。");
      setGachaStatus('waiting-coin');
      return;
    }
    setGachaStatus('cranking');
    setShakeMachine(true);
    setCapsuleColor(['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'][Math.floor(Math.random() * 8)]);
    setTimeout(() => {
      setShakeMachine(false);
      setGachaStatus('capsule-out');
    }, 1500);
  };

  const openCapsuleAnim = () => {
    if (gachaStatus !== 'capsule-out') return;
    
    // 取得下一個結果
    const mapping = preCalculatedBeds.length > 0 ? preCalculatedBeds : generateValidMapping();
    const nextResult = mapping[results.length];
    if (!nextResult) return;

    setOpeningResult(nextResult);
    setCapsuleStage('shaking');
    
    // 播放抖動 -> 爆開 -> 展示動畫
    setTimeout(() => setCapsuleStage('popping'), 800);
    setTimeout(() => setCapsuleStage('revealing'), 1400);
  };

  const closeRevealAndSave = () => {
    if (!openingResult) return;
    setResults(prev => [...prev, openingResult]);
    if (results.length + 1 >= 10) setGachaStatus('finished');
    else setGachaStatus('waiting-coin');
    setOpeningResult(null);
    setCapsuleStage('idle');
  };

  const handleCarShuffle = async () => {
    if (isCarShuffling) return;
    setIsCarShuffling(true);
    setTimeout(async () => {
      const c4f = RAFFLE_MEMBERS.filter(m => fixedSeats[m] === 'car4');
      const c6f = RAFFLE_MEMBERS.filter(m => fixedSeats[m] === 'car6');
      const rem = RAFFLE_MEMBERS.filter(m => !fixedSeats[m]).sort(() => Math.random() - 0.5);
      const finalCar4 = [...c4f, ...rem.slice(0, 4 - c4f.length)].sort(() => Math.random() - 0.5);
      const finalCar6 = [...c6f, ...rem.slice(4 - c4f.length)].sort(() => Math.random() - 0.5);
      const res = { car4: finalCar4, car6: finalCar6 };
      setCarResults(res);
      await updateDoc(doc(db, "travelData", "raffle"), { carResults: res });
      setIsCarShuffling(false);
    }, 1200);
  };

  const updateFixedBed = async (member: string, bedId: string | null) => {
    const newFixed = { ...fixedBeds };
    if (bedId) Object.keys(newFixed).forEach(m => { if (newFixed[m] === bedId) newFixed[m] = null; });
    newFixed[member] = bedId;
    const test = generateValidMapping(newFixed);
    if (test.length === 0) {
      alert("🚨 設定失敗：此固定組合將導致 Nica 與 Ethan 鄰近衝突，請換個位置！");
      return;
    }
    setFixedBeds(newFixed);
    await updateDoc(doc(db, "travelData", "raffle"), { fixedBeds: newFixed });
    setPreCalculatedBeds(test);
  };

  const updateFixedSeat = async (member: string, seat: 'car4' | 'car6' | null) => {
    const newFixed = { ...fixedSeats, [member]: seat };
    setFixedSeats(newFixed);
    await updateDoc(doc(db, "travelData", "raffle"), { fixedSeats: newFixed });
  };

  const verifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '1130') { setShowPasswordModal(false); }
    else { setPasswordError(true); setTimeout(() => setPasswordError(false), 500); }
  };

  const handleEditToggle = (type: 'cars' | 'beds') => {
    if (isEditMode === type) { setIsEditMode('none'); }
    else { 
      setIsEditMode(type); 
      setShowPasswordModal(true); 
      setPasswordInput(''); 
      setPasswordError(false); 
    }
  };

  const getRainbowColor = (index: number) => ['#FF8A8A', '#FFB347', '#FBC02D', '#D4E157', '#66BB6A', '#4DD0E1', '#5C6BC0', '#9575CD', '#F06292', '#FF7043', '#F06292', '#F48FB1'][index % 12];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex bg-white/70 backdrop-blur-md p-1.5 rounded-[2.5rem] border border-blue-100 shadow-sm mx-auto w-full sticky top-24 z-50 overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('wheel')} className={`flex-1 flex items-center justify-center gap-1.5 py-4 px-3 rounded-[2rem] font-black text-[10px] transition-all min-w-[90px] ${activeTab === 'wheel' ? 'bg-[#0077B6] text-white shadow-lg' : 'text-blue-300'}`}>
          <RotateCw size={14} /> 幸運轉盤
        </button>
        <button onClick={() => setActiveTab('beds')} className={`flex-1 flex items-center justify-center gap-1.5 py-4 px-3 rounded-[2rem] font-black text-[10px] transition-all min-w-[90px] ${activeTab === 'beds' ? 'bg-[#FF4D4D] text-white shadow-lg' : 'text-rose-300'}`}>
          <Bed size={14} /> 宿舍分配
        </button>
        <button onClick={() => setActiveTab('cars')} className={`flex-1 flex items-center justify-center gap-1.5 py-4 px-3 rounded-[2rem] font-black text-[10px] transition-all min-w-[90px] ${activeTab === 'cars' ? 'bg-[#4CAF50] text-white shadow-lg' : 'text-emerald-300'}`}>
          <Car size={14} /> 戰車分配
        </button>
      </div>

      {activeTab === 'wheel' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          <div className="text-center"><h2 className="text-4xl font-black text-[#00A8FF] flex items-center justify-center gap-3 italic">🎡 幸運大轉盤</h2><p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] mt-2">Hoya Team Random Draw</p></div>
          <div className="relative flex flex-col items-center py-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-40"><div className="relative w-12 h-16 bg-[#FF4D4D] clip-path-pointer shadow-lg border-t-4 border-[#FF6B6B] flex justify-center pt-2"><div className="w-3 h-3 bg-white rounded-full"></div></div></div>
            <div className="w-[360px] h-[360px] rounded-full relative shadow-[0_25px_60px_rgba(0,168,255,0.3)] transition-transform duration-[4500ms] cubic-bezier-out border-[14px] border-white overflow-hidden ring-4 ring-blue-50/50" style={{ transform: `rotate(${rotation}deg)`, background: `conic-gradient(${WHEEL_MEMBERS.map((_, i) => `${getRainbowColor(i)} ${i * 30}deg ${(i + 1) * 30}deg`).join(', ')})` }}>
              {WHEEL_MEMBERS.map((member, index) => {
                const angle = (index * 30) + 15;
                return (
                  <div key={index} className="absolute top-1/2 left-1/2 flex items-center justify-center" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-110px) rotate(90deg)`, width: '160px' }}>
                    <div className="flex flex-row items-center gap-2 pr-2 py-0.5">
                        <MemberBadge name={member} customPhoto={memberProfiles[member]?.photo} size="w-10 h-10" textScale="text-[10px]" />
                        <span className="text-white font-black text-[10px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase tracking-tighter truncate max-w-[70px]">{member}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => { if (isSpinning) return; setIsSpinning(true); const newRotation = rotation + 2880 + Math.floor(Math.random() * 360); setRotation(newRotation); setTimeout(() => { setIsSpinning(false); const pointerPos = (360 - (newRotation % 360)) % 360; const index = Math.floor(pointerPos / 30); setWinner(WHEEL_MEMBERS[index]); setWinnerIndex(TEAM_MEMBERS.indexOf(WHEEL_MEMBERS[index])); setShowWinnerModal(true); }, 4500); }} disabled={isSpinning} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-white shadow-2xl z-30 flex items-center justify-center active:scale-90 transition-all border-4 border-gray-50 ring-8 ring-white/30"><RotateCw size={44} className={`text-[#00A8FF] ${isSpinning ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      )}

      {activeTab === 'beds' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-rose-50 overflow-hidden relative">
             <div className="absolute top-0 left-0 w-full h-2 rainbow-bg opacity-30"></div>
             <div className="flex justify-between items-start mb-8 relative z-[20]">
                <div className="space-y-2">
                  <h3 className="font-black text-2xl text-gray-800 flex items-center gap-2 italic"><Ghost className="text-rose-400 animate-bounce" size={24} /> 宿舍大風吹</h3>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleEditToggle('beds')} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isEditMode === 'beds' ? 'bg-rose-500 text-white shadow-lg animate-pulse' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}
                    >
                      {isEditMode === 'beds' ? <Unlock size={10} /> : <Lock size={10} />} 管理員設定
                    </button>
                    <button 
                      onClick={() => setShowResetConfirm(true)} 
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white text-rose-400 border-2 border-rose-100 hover:border-rose-400 transition-all active:scale-90 shadow-sm relative z-30"
                    >
                      <RotateCw size={10} /> 清空結果
                    </button>
                  </div>
                </div>
                <div className="bg-rose-50 px-4 py-2 rounded-2xl border border-rose-100 flex items-center gap-2 shadow-inner"><span className="text-xs font-black text-rose-500">{results.length} / 10</span></div>
             </div>

             <div className="relative flex flex-col items-center py-4 mb-8">
                <div className={`w-64 h-56 bg-gradient-to-b from-blue-100/40 to-white/60 rounded-t-[4rem] border-x-8 border-t-8 border-gray-200 relative shadow-xl transition-transform ${shakeMachine ? 'animate-shake' : ''}`}>
                   <div className="absolute inset-0 p-4 flex flex-wrap gap-1.5 items-center justify-center content-center overflow-hidden">
                      {[...Array(12 - results.length)].map((_, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full shadow-md border-t-2 border-white/50 ${shakeMachine ? 'animate-bounce-custom' : ''}`} style={{ backgroundColor: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'][i % 8], animationDelay: `${i * 0.05}s` }}></div>
                      ))}
                   </div>
                </div>
                <div className={`w-72 h-32 bg-[#FF4D4D] border-x-8 border-gray-200 flex items-center justify-between px-10 relative shadow-2xl z-20 ${shakeMachine ? 'animate-shake' : ''}`}>
                   <div className="flex flex-col items-center gap-2"><div className="w-2 h-10 bg-red-900/20 rounded-full border-2 border-white/30 shadow-inner relative flex items-center justify-center">{(gachaStatus === 'waiting-coin' || gachaStatus === 'finished') && results.length < 10 && (<button onClick={() => setGachaStatus('ready-to-crank')} className="absolute -left-10 w-12 h-12 rounded-full bg-yellow-400 border-4 border-white shadow-xl flex items-center justify-center animate-bounce hover:scale-110 transition-all z-30"><Coins size={24} /></button>)}</div></div>
                   <div className="flex flex-col items-center gap-2"><button onClick={handleCrank} disabled={gachaStatus !== 'ready-to-crank'} className={`w-16 h-16 rounded-full bg-white border-4 border-gray-100 shadow-xl flex items-center justify-center transition-all ${gachaStatus === 'cranking' ? 'animate-spin' : 'hover:scale-105 hover:rotate-45'}`}><div className="w-10 h-2 bg-gray-200 rounded-full"></div></button></div>
                </div>
                <div className="w-64 h-24 bg-gradient-to-b from-[#e63946] to-[#c1121f] rounded-b-[2rem] border-x-8 border-b-8 border-gray-200 relative flex justify-center items-center">
                   <div className="w-20 h-14 bg-black/20 rounded-xl shadow-inner border-4 border-red-900/20 flex items-center justify-center relative"><div className="absolute top-10 w-28 h-12 bg-gray-100/80 backdrop-blur rounded-b-2xl border-x-4 border-b-4 border-gray-200 shadow-2xl z-10"></div></div>
                   {gachaStatus === 'capsule-out' && (<div onClick={openCapsuleAnim} className="absolute bottom-[-10px] w-14 h-14 rounded-full cursor-pointer animate-in zoom-in slide-in-from-top-10 duration-300 hover:scale-110 z-40 flex items-center justify-center shadow-lg border-4 border-white overflow-hidden" style={{ backgroundColor: capsuleColor }}><div className="w-full h-1 bg-black/10 absolute top-1/2 -translate-y-1/2"></div><Sparkles className="text-white/80 animate-pulse" size={16} /></div>)}
                </div>
             </div>
             {results.length < 10 && gachaStatus !== 'cranking' && (
                <div className="flex justify-center mb-8 animate-in fade-in duration-700">
                  <button onClick={handleDrawAll} className="group relative flex items-center gap-3 px-8 py-4 text-white font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all overflow-hidden rounded-full" style={{ background: macaronRainbowGradient }}><div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div><Zap size={16} className="animate-pulse" /><span>彩虹能量！一鍵全開</span><Sparkles size={16} className="animate-bounce" /></button>
                </div>
             )}
             <div className="grid grid-cols-2 gap-4">
                {ALL_BED_IDS.map((id) => {
                  const res = results.find(r => r.bedId === id);
                  const photoUrl = res ? (memberProfiles[res.member]?.photo || MEMBER_PHOTOS[res.member]) : null;
                  return (
                    <div key={id} className="w-full aspect-square">
                      {res ? (
                        <div className="relative w-full h-full rounded-[2rem] shadow-lg border-2 border-white/40 overflow-hidden animate-in zoom-in duration-500">
                           {photoUrl ? (<img src={photoUrl} alt={res.member} className="absolute inset-0 w-full h-full object-cover scale-110" />) : (<div className={`absolute inset-0 bg-gradient-to-br ${BED_COLORS[id]}`}></div>)}
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                           <div className="relative h-full p-4 flex flex-col justify-between z-10">
                              <div className="flex justify-between items-start"><span className="text-[8px] font-black text-white/90 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">{id}</span>{Object.values(fixedBeds).includes(id) && (<div className="bg-rose-500/80 p-1 rounded-full shadow-lg border border-white/20"><Pin size={8} className="text-white" fill="currentColor" /></div>)}</div>
                              <div className="flex flex-col gap-0.5">
                                <h5 className="text-base font-black text-white truncate tracking-tight uppercase drop-shadow-md">{res.member}</h5>
                                <p className="text-[8px] font-bold text-white/70 truncate">{res.title}</p>
                              </div>
                           </div>
                        </div>
                      ) : (<div className="w-full h-full rounded-[2rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center gap-2 bg-gray-50/30 shadow-inner"><Bed size={20} className="text-gray-200" /><span className="text-[8px] font-black text-gray-200 uppercase">{id}</span></div>)}
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      {/* 開扭蛋動畫與揭曉結果 */}
      {openingResult && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500"></div>
          
          <div className="relative w-full max-w-sm flex flex-col items-center justify-center p-6 text-center">
            {/* 扭蛋本體動畫 */}
            <div className="relative w-64 h-64 flex items-center justify-center mb-10">
               {/* 頂部外殼 */}
               <div 
                 className={`absolute w-64 h-32 rounded-t-full border-x-4 border-t-4 border-white/30 shadow-2xl transition-all duration-700 ease-out z-20
                   ${capsuleStage === 'shaking' ? 'animate-capsule-shake' : ''}
                   ${capsuleStage === 'popping' || capsuleStage === 'revealing' ? '-translate-y-40 -rotate-12 opacity-0' : 'translate-y-[-1px]'}
                 `}
                 style={{ backgroundColor: capsuleColor, filter: 'brightness(1.1)' }}
               >
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-black/10 rounded-full"></div>
               </div>
               
               {/* 底部外殼 */}
               <div 
                 className={`absolute w-64 h-32 rounded-b-full border-x-4 border-b-4 border-white/20 shadow-2xl transition-all duration-700 ease-out z-10
                   ${capsuleStage === 'shaking' ? 'animate-capsule-shake' : ''}
                   ${capsuleStage === 'popping' || capsuleStage === 'revealing' ? 'translate-y-40 rotate-12 opacity-0' : 'translate-y-[31px]'}
                 `}
                 style={{ backgroundColor: capsuleColor, filter: 'brightness(0.9)' }}
               >
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-white/20 rounded-full"></div>
               </div>

               {/* 爆發光芒 */}
               {(capsuleStage === 'popping' || capsuleStage === 'revealing') && (
                 <div className="absolute inset-0 flex items-center justify-center z-15 animate-in zoom-in duration-300">
                    <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_120px_60px_rgba(255,255,255,0.8)] animate-pulse"></div>
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute w-2 h-16 rainbow-bg rounded-full animate-beam" 
                        style={{ transform: `rotate(${i * 30}deg) translateY(-100px)`, animationDelay: `${i * 0.05}s` }}
                      ></div>
                    ))}
                 </div>
               )}

               {/* 結果揭曉內容 */}
               <div className={`absolute z-30 transition-all duration-700 ease-out
                 ${capsuleStage === 'revealing' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-12'}
               `}>
                 <div className="relative group">
                    <div className="absolute -inset-6 bg-white/20 rounded-[4rem] blur-2xl animate-pulse"></div>
                    <div className="relative bg-white rounded-[3.5rem] p-2 shadow-2xl border-4 border-white overflow-hidden w-64 aspect-[4/5] flex flex-col">
                       <div className="relative flex-1 overflow-hidden rounded-[2.8rem]">
                         <img 
                           src={memberProfiles[openingResult.member]?.photo || MEMBER_PHOTOS[openingResult.member]} 
                           className="w-full h-full object-cover" 
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                         <div className="absolute bottom-4 left-0 right-0 px-4">
                            <span className="text-[10px] font-black text-white/70 tracking-[0.3em] uppercase">Bed Allocated</span>
                            <h4 className="text-4xl font-black text-white tracking-tighter drop-shadow-lg italic">{openingResult.member}</h4>
                         </div>
                       </div>
                    </div>
                    {/* 漂浮的小裝飾 */}
                    <div className="absolute -top-6 -right-6 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl border-4 border-white rotate-12 animate-bounce">
                      {openingResult.bedId}
                    </div>
                 </div>
               </div>
            </div>

            {/* 下方文字 */}
            <div className={`transition-all duration-700 delay-300 ${capsuleStage === 'revealing' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
               <h3 className="text-2xl font-black text-white italic mb-2">{openingResult.title}</h3>
               <p className="text-white/60 text-xs font-bold uppercase tracking-[0.4em] mb-8">Hoya Dream Cabin #{openingResult.bedId}</p>
               <button 
                 onClick={closeRevealAndSave}
                 className="px-12 py-5 bg-white text-rose-500 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3 mx-auto"
               >
                 <Check size={20} /> 收下這個好位子
               </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cars' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
           <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl border-4 border-emerald-50 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-emerald-100 opacity-50"></div>
             <div className="flex justify-between items-center mb-8 relative z-10"><div><h3 className="font-black text-2xl text-gray-800 flex items-center gap-3 tracking-tight italic"><Car className="text-emerald-500" size={28} /> 戰車大分配</h3><p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mt-1">Car Allocation</p></div><button onClick={() => handleEditToggle('cars')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isEditMode === 'cars' ? 'bg-rose-500 text-white shadow-lg animate-pulse' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{isEditMode === 'cars' ? <Unlock size={14} /> : <Lock size={14} />}固定位設定</button></div>
             <div className="space-y-10">
                <div className="space-y-4"><div className="flex items-center justify-between px-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600"><Users size={20} /></div><h4 className="font-black text-gray-700 italic">小戰車 (4人座)</h4></div></div>
                   <div className="grid grid-cols-2 gap-3">{(carResults?.car4 || RAFFLE_MEMBERS.slice(0, 4)).map((name, i) => (<div key={i} className={`bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 flex items-center gap-3 transition-all ${fixedSeats[name] === 'car4' ? 'ring-2 ring-emerald-300 bg-white shadow-md' : ''}`}><MemberBadge name={name} customPhoto={memberProfiles[name]?.photo} size="w-12 h-12" isShuffling={isCarShuffling} /><div className="flex flex-col truncate"><span className="font-black text-xs text-gray-700">{name}</span>{fixedSeats[name] === 'car4' && <span className="text-[7px] font-black text-emerald-500 flex items-center gap-1 mt-0.5"><Pin size={8} /> 固定席</span>}</div></div>))}</div>
                </div>
                <div className="space-y-4"><div className="flex items-center justify-between px-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><Users size={20} /></div><h4 className="font-black text-gray-700 italic">大戰車 (6人座)</h4></div></div>
                   <div className="grid grid-cols-2 gap-3">{(carResults?.car6 || RAFFLE_MEMBERS.slice(4)).map((name, i) => (<div key={i} className={`bg-blue-50/50 p-4 rounded-3xl border border-blue-100 flex items-center gap-3 transition-all ${fixedSeats[name] === 'car6' ? 'ring-2 ring-blue-300 bg-white shadow-md' : ''}`}><MemberBadge name={name} customPhoto={memberProfiles[name]?.photo} size="w-12 h-12" isShuffling={isCarShuffling} /><div className="flex flex-col truncate"><span className="font-black text-xs text-gray-700">{name}</span>{fixedSeats[name] === 'car6' && <span className="text-[7px] font-black text-blue-500 flex items-center gap-1 mt-0.5"><Pin size={8} /> 固定席</span>}</div></div>))}</div>
                </div>
                <button onClick={handleCarShuffle} disabled={isCarShuffling} className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black shadow-xl flex items-center justify-center gap-3 transition-all text-base border-b-8 border-emerald-800 active:scale-95 disabled:opacity-80">
                  {isCarShuffling ? <RotateCw size={20} className="animate-spin" /> : <Shuffle size={20} />} 大風吹！重新分配自由席
                </button>
             </div>
           </div>
        </div>
      )}

      {showWinnerModal && winner && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6"><div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowWinnerModal(false)}></div><div className="w-full max-w-xs rounded-[3.5rem] shadow-2xl relative p-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-300 border-4 border-white" style={{ backgroundColor: PRIDE_COLORS[winnerIndex !== null ? winnerIndex % PRIDE_COLORS.length : 0] }}><MemberBadge name={winner} customPhoto={memberProfiles[winner]?.photo} size="w-32 h-32" className="border-8 border-white/50 shadow-2xl mb-6" /><div className="flex flex-col gap-1 mb-12"><span className="text-5xl font-black text-white drop-shadow-md uppercase italic">{winner}</span>{memberProfiles[winner]?.title && <span className="text-xs font-black text-white/80 tracking-[0.2em]">{memberProfiles[winner].title}</span>}</div><button onClick={() => setShowWinnerModal(false)} className="w-full py-5 bg-white rounded-[2rem] font-black shadow-lg text-lg flex items-center justify-center gap-2" style={{ color: PRIDE_COLORS[winnerIndex !== null ? winnerIndex % PRIDE_COLORS.length : 0] }}>收下好運 <Sparkles size={20} /></button></div></div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-white animate-in fade-in duration-300">
           <div className={`bg-white w-full max-w-xs rounded-[3rem] p-8 shadow-2xl border-4 border-rose-100 transition-transform ${passwordError ? 'animate-shake' : ''}`}>
              <div className="flex flex-col items-center text-center gap-5">
                 <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner"><Lock size={32} /></div>
                 <h3 className="text-xl font-black text-gray-800 tracking-tight italic">管理員驗證</h3>
                 <form onSubmit={verifyPassword} className="w-full space-y-5">
                    <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="請輸入密碼..." autoFocus className={`w-full bg-rose-50/30 border-2 rounded-2xl p-4 text-center text-2xl font-black outline-none transition-all ${passwordError ? 'border-red-400 text-red-500' : 'border-rose-100 focus:border-rose-400 text-gray-700'}`} />
                    <div className="flex gap-3"><button type="button" onClick={() => { setShowPasswordModal(false); setIsEditMode('none'); }} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-[11px] uppercase tracking-widest">取消</button><button type="submit" className="flex-[2] py-4 bg-rose-500 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg">確認解鎖</button></div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* 宿舍清空確認頁面 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white animate-in slide-in-from-bottom duration-500 overflow-hidden">
          <div className="w-full h-full flex flex-col max-w-md mx-auto relative pt-14 px-7 pb-10 overflow-y-auto scrollbar-hide bg-[#fffbfc]">
            <button onClick={() => setShowResetConfirm(false)} className="fixed top-6 right-6 p-2 bg-gray-100 text-gray-500 rounded-full transition-colors z-[310]"><X size={24} /></button>
            
            <div className="flex flex-col items-center justify-center flex-1 space-y-8 py-10">
              <div className="w-32 h-32 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center shadow-xl border-4 border-rose-100 animate-bounce">
                <Trash2 size={64} />
              </div>
              
              <div className="text-center space-y-4">
                <h3 className="text-4xl font-black text-gray-800 italic">確定要清空嗎？</h3>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">
                  這將會移除目前的所有床位分配。<br/>你需要重新投入硬幣進行扭蛋抽籤！
                </p>
              </div>

              <div className="w-full space-y-4 pt-10">
                <button 
                  onClick={handleResetBeds} 
                  className="w-full py-7 bg-rose-500 text-white rounded-[2.5rem] font-black shadow-xl flex items-center justify-center gap-3 transition-all text-2xl border-b-8 border-rose-700 active:scale-95"
                >
                  <Check size={32} /> 確定清空
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)} 
                  className="w-full py-6 bg-gray-100 text-gray-400 rounded-[2.5rem] font-black flex items-center justify-center gap-3 transition-all text-xl active:scale-95"
                >
                  <ArrowLeft size={24} /> 返回分配
                </button>
              </div>
            </div>
            
            <div className="p-8 bg-rose-50/30 rounded-[2.5rem] border border-rose-100 text-center mt-auto">
               <p className="text-[10px] font-black text-rose-300 uppercase tracking-[0.4em]">Collective Decision Required</p>
            </div>
          </div>
        </div>
      )}

      {isEditMode !== 'none' && !showPasswordModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white animate-in slide-in-from-bottom duration-500 overflow-hidden">
           <div className="w-full h-full flex flex-col max-w-md mx-auto relative pt-14 px-7 pb-10 overflow-y-auto scrollbar-hide bg-[#fffbfc]">
             <button onClick={() => setIsEditMode('none')} className="fixed top-6 right-6 p-2 bg-gray-100 text-gray-500 rounded-full transition-colors z-[310]"><X size={24} /></button>
             
             {isEditMode === 'beds' ? (
                <div className="space-y-6">
                   <div className="mb-2"><h3 className="text-3xl font-black text-gray-800 italic flex items-center gap-2"><Pin size={24} className="text-rose-500" /> 宿舍床位鎖定</h3><p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Hoya Bed Admin Mode</p></div>
                   <div className="bg-rose-50/50 p-6 rounded-[2.5rem] border border-rose-100 space-y-4">
                      <div className="flex items-start gap-3 text-rose-400"><Star size={14} className="mt-0.5 fill-current" /><p className="text-[10px] font-bold leading-relaxed uppercase tracking-widest">設定固定後，點擊「清空結果」會移除目前分配。系統會自動進行衝突排除。</p></div>
                      <div className="space-y-3">
                         {RAFFLE_MEMBERS.map(member => (
                           <div key={member} className="flex flex-col gap-3 p-4 bg-white rounded-[2rem] border border-rose-100 shadow-sm">
                              <div className="flex items-center gap-3"><MemberBadge name={member} customPhoto={memberProfiles[member]?.photo} size="w-10 h-10" /><span className="text-sm font-black text-gray-700">{member}</span></div>
                              <div className="grid grid-cols-5 gap-1.5">
                                 {ALL_BED_IDS.map(bid => (<button key={bid} onClick={() => updateFixedBed(member, bid)} className={`py-2 rounded-xl text-[9px] font-black transition-all border-2 ${fixedBeds[member] === bid ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105' : 'bg-gray-50 text-gray-400 border-transparent opacity-60'}`}>{bid}</button>))}
                                 <button onClick={() => updateFixedBed(member, null)} className={`py-2 rounded-xl text-[9px] font-black transition-all border-2 ${!fixedBeds[member] ? 'bg-gray-200 text-gray-600 border-gray-300' : 'bg-gray-50 text-gray-300 border-transparent opacity-60'}`}>隨機</button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button onClick={() => setIsEditMode('none')} className="w-full py-6 bg-rose-500 text-white rounded-[2rem] font-black shadow-xl flex items-center justify-center gap-3 transition-all text-xl border-b-8 border-black/10"><Check size={24} /> 完成設定並儲存</button>
                </div>
             ) : (
                <div className="space-y-6">
                   <div className="mb-2"><h3 className="text-3xl font-black text-gray-800 italic flex items-center gap-2"><Car size={24} className="text-emerald-500" /> 戰車固定位鎖定</h3><p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Car Admin Mode</p></div>
                   <div className="bg-emerald-50/50 p-6 rounded-[2.5rem] border border-emerald-100 space-y-4">
                      <div className="flex items-start gap-3 text-emerald-600"><Star size={14} className="mt-0.5 fill-current" /><p className="text-[10px] font-bold leading-relaxed uppercase tracking-widest">鎖定成員在特定戰車，其餘位置將在點擊「大風吹」時隨機分配。</p></div>
                      <div className="space-y-3">
                         {RAFFLE_MEMBERS.map(member => (
                           <div key={member} className="flex flex-col gap-3 p-4 bg-white rounded-[2rem] border border-emerald-100 shadow-sm">
                              <div className="flex items-center gap-3"><MemberBadge name={member} customPhoto={memberProfiles[member]?.photo} size="w-10 h-10" /><span className="text-sm font-black text-gray-700">{member}</span></div>
                              <div className="flex gap-2">
                                 <button onClick={() => updateFixedSeat(member, 'car4')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${fixedSeats[member] === 'car4' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-gray-50 text-gray-400 border-transparent opacity-60'}`}>小戰車 (4人)</button>
                                 <button onClick={() => updateFixedSeat(member, 'car6')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${fixedSeats[member] === 'car6' ? 'bg-blue-500 text-white border-blue-600 shadow-md' : 'bg-gray-50 text-gray-400 border-transparent opacity-60'}`}>大戰車 (6人)</button>
                                 <button onClick={() => updateFixedSeat(member, null)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${!fixedSeats[member] ? 'bg-gray-200 text-gray-600 border-gray-300' : 'bg-gray-50 text-gray-300 border-transparent opacity-60'}`}>隨機位</button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button onClick={() => setIsEditMode('none')} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black shadow-xl flex items-center justify-center gap-3 transition-all text-xl border-b-8 border-black/10"><Check size={24} /> 完成設定並儲存</button>
                </div>
             )}
           </div>
        </div>
      )}

      <style>{`
        .clip-path-pointer { clip-path: polygon(50% 100%, 0 0, 100% 0); }
        .cubic-bezier-out { transition-timing-function: cubic-bezier(0.1, 0, 0.1, 1); }
        
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.15s infinite; }
        
        @keyframes capsule-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-10px) rotate(-5deg); }
          50% { transform: translateX(10px) rotate(5deg); }
          75% { transform: translateX(-5px) rotate(-2deg); }
        }
        .animate-capsule-shake { animation: capsule-shake 0.1s infinite; }

        @keyframes beam {
          0% { transform: rotate(var(--tw-rotate)) translateY(0) scaleY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: rotate(var(--tw-rotate)) translateY(-300px) scaleY(2); opacity: 0; }
        }
        .animate-beam { animation: beam 1.5s ease-out forwards; }

        @keyframes bounce-custom { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-45px) rotate(12deg); } }
        .animate-bounce-custom { animation: bounce-custom 0.4s infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        
        @keyframes shuffle-pop {
          0% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(5deg); }
          50% { transform: scale(0.9) rotate(-5deg); }
          75% { transform: scale(1.05) rotate(3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-shuffle-pop { animation: shuffle-pop 0.3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Raffle;