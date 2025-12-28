import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TabType } from './types';
import Checklist from './components/Checklist';
import Itinerary from './components/Itinerary';
import Booking from './components/Booking';
import Wallet from './components/Wallet';
import Mission from './components/Mission';
import Raffle from './components/Raffle';
import Game from './components/Game';
import Achievement from './components/Achievement';
// Fix: Import TRIP_START_DATE and remove non-existent TEAM_MEMBERS_TITLES_DEFAULT
import { TEAM_MEMBERS, PRIDE_COLORS, MEMBER_PHOTOS, TRIP_START_DATE } from './constants';
import { getOmikuji } from './services/gemini';
import { db } from './services/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, deleteField } from "firebase/firestore";
import { Sparkles, Loader2, X, Heart, Trophy, MapPin, Check, Pin, Zap, Settings, UserCircle, Camera, Fingerprint, Lock, ShieldCheck, Save, Upload, RefreshCw, Info, Wrench, ShieldAlert, KeyRound, Unlock, ShieldQuestion } from 'lucide-react';

const TEAM_TITLES: Record<string, string> = {
  'Sean': '首席領航員 ✈️',
  'Ben': '和牛鑑定師 🥩',
  'Oedi': '時尚急先鋒 💅',
  'Wilson': '酒精管理員 🥂',
  'Ethan': '美照攝影師 📸',
  'William': '血拼戰神 🛍️',
  'Alvin': '迷路小隊長 🗺️',
  'Sophia': '微笑外交官 ✨',
  'Daisy': '甜點巡邏隊 🍰',
  'Jennifer': '情報分析官 🔍',
  'Sebrina': '採買總指揮 🛒',
  'Nica': '最萌吉祥物 🦄'
};

const LIVE_STATUSES = [
  { emoji: '🚫', text: '不顯示' },
  { emoji: '🛫', text: '出發中' },
  { emoji: '🍱', text: '覓食中' },
  { emoji: '💸', text: '買爆中' },
  { emoji: '😵‍💫', text: '斷片中' },
  { emoji: '🗺️', text: '迷路中' },
  { emoji: '📸', text: '拍美照' },
  { emoji: '🛌', text: '躺平中' }
];

const MemberAvatar: React.FC<{ 
  name: string; 
  index: number; 
  size?: string; 
  className?: string; 
  currentStatus?: string; 
  customTitle?: string; 
  customPhoto?: string; 
  disablePop?: boolean;
  onPopStateChange?: (popping: boolean) => void; 
  onOpenStatusMenu: () => void 
}> = ({ name, index, size = "w-10 h-10", className = "", currentStatus = "🚫 不顯示", customTitle, customPhoto, disablePop = false, onPopStateChange, onOpenStatusMenu }) => {
  const [isPopping, setIsPopping] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const isLongPressActive = useRef(false);
  
  const bgColor = PRIDE_COLORS[index % PRIDE_COLORS.length];
  const photoUrl = customPhoto || MEMBER_PHOTOS[name];
  const title = customTitle || TEAM_TITLES[name] || 'Hoya 團員';

  const playPopSound = (freq = 800) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressActive.current = false;
    longPressTimer.current = window.setTimeout(() => {
      isLongPressActive.current = true;
      onOpenStatusMenu(); 
      playPopSound(400); 
      if (navigator.vibrate) navigator.vibrate([40, 20]);
    }, 600);
  };

  const handleEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!isLongPressActive.current && !disablePop) {
      triggerPopEffect();
    }
  };

  const triggerPopEffect = () => {
    if (isPopping) return;
    setIsPopping(true);
    onPopStateChange?.(true);
    playPopSound(800);
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(() => { 
      setIsPopping(false); 
      onPopStateChange?.(false);
    }, 1500);
  };

  const displayEmoji = currentStatus?.split(' ')[0] || '🚫';
  const shouldShowStatus = displayEmoji !== '🚫';

  return (
    <div className={`flex flex-col items-center relative ${isPopping ? 'z-[1000]' : 'z-0'}`}>
      <div 
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        className={`relative group outline-none select-none touch-none transition-all duration-300 ${isPopping ? 'animate-click-squash' : 'hover:scale-105 active:scale-95'}`}
      >
        {isPopping && !disablePop && (
          <>
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${bgColor} z-40`} />
            <div className="absolute inset-0 z-[1100] pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`absolute text-rose-400 animate-burst-heart-${i+1}`}>
                    <Heart size={14} fill="currentColor" />
                  </div>
                ))}
              </div>
              <div className={`absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-full text-white font-black text-[11px] shadow-2xl animate-title-burst z-[1110] border-2 border-white ${bgColor}`}>
                {title}
                <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${bgColor} border-r-2 border-b-2 border-white`}></div>
              </div>
            </div>
          </>
        )}

        <div className={`${size} rounded-full border-2 border-white shadow-md overflow-hidden flex-shrink-0 bg-white relative z-10 ${className}`}>
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white font-black text-[11px] uppercase ${bgColor}`}>
              {name[0]}
            </div>
          )}
        </div>

        {shouldShowStatus && !isPopping && (
          <div className="absolute -top-1 -right-1 bg-white rounded-full px-1 py-0.5 shadow-sm border border-rose-100 z-20 animate-bounce-slow pointer-events-none">
             <span className="text-[10px] leading-none">{displayEmoji}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes click-squash {
          0% { transform: scale(1); }
          20% { transform: scale(0.8, 1.2); }
          40% { transform: scale(1.2, 0.8); }
          60% { transform: scale(0.9, 1.1); }
          100% { transform: scale(1); }
        }
        .animate-click-squash { animation: click-squash 0.5s ease-out; }

        @keyframes title-burst {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0); }
          15% { opacity: 1; transform: translate(-50%, -15px) scale(1.2); }
          30% { transform: translate(-50%, -10px) scale(0.95); }
          45% { transform: translate(-50%, -12px) scale(1.05); }
          60% { transform: translate(-50%, -12px) scale(1); }
          85% { opacity: 1; transform: translate(-50%, -12px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -30px) scale(0.8); }
        }
        .animate-title-burst { animation: title-burst 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        ${[
          { x: -50, y: -50, r: -20 },
          { x: 50, y: -50, r: 20 },
          { x: -70, y: 10, r: -45 },
          { x: 70, y: 10, r: 45 },
          { x: -30, y: 50, r: -10 },
          { x: 30, y: 50, r: 10 }
        ].map((dir, i) => `
          @keyframes burst-heart-${i+1} {
            0% { opacity: 0; transform: translate(0, 0) scale(0) rotate(0deg); }
            20% { opacity: 1; transform: translate(${dir.x * 0.4}px, ${dir.y * 0.4}px) scale(1) rotate(${dir.r * 0.5}deg); }
            100% { opacity: 0; transform: translate(${dir.x}px, ${dir.y}px) scale(0.5) rotate(${dir.r}deg); }
          }
          .animate-burst-heart-${i+1} { animation: burst-heart-${i+1} 1s ease-out forwards; }
        `).join('')}
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [fortune, setFortune] = useState<string | null>(null);
  const [isFortuneLoading, setIsFortuneLoading] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [teamStatus, setTeamStatus] = useState<Record<string, string>>({});
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { title: string, photo: string, isLocked: boolean, photoLocked?: boolean }>>({});
  const [statusMenuMember, setStatusMenuMember] = useState<string | null>(null);
  const [poppingMembers, setPoppingMembers] = useState<Record<string, boolean>>({});

  const [showSettings, setShowSettings] = useState(false);
  const [settingsStep, setSettingsStep] = useState<'select' | 'auth' | 'edit' | 'admin' | 'admin-auth'>('select');
  const [targetMember, setTargetMember] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editPin, setEditPin] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubStatus = onSnapshot(doc(db, "travelData", "teamStatus"), (docSnap) => {
      if (docSnap.exists()) setTeamStatus(docSnap.data());
    });

    const unsubProfiles = onSnapshot(doc(db, "travelData", "memberProfiles"), (docSnap) => {
      if (docSnap.exists()) {
        setMemberProfiles(docSnap.data());
      } else {
        const initialProfiles: Record<string, any> = {};
        TEAM_MEMBERS.forEach(m => {
          initialProfiles[m] = { title: TEAM_TITLES[m], photo: MEMBER_PHOTOS[m], isLocked: false, photoLocked: false };
        });
        setDoc(doc(db, "travelData", "memberProfiles"), initialProfiles);
        setMemberProfiles(initialProfiles);
      }
    });

    const timer = setInterval(() => {
      const now = new Date();
      const diff = TRIP_START_DATE.getTime() - now.getTime();
      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          mins: Math.floor((diff / 1000 / 60) % 60),
          secs: Math.floor((diff / 1000) % 60)
        });
      }
    }, 1000);
    
    return () => { unsubStatus(); unsubProfiles(); clearInterval(timer); };
  }, []);

  const handlePopChange = (name: string, isPopping: boolean) => {
    setPoppingMembers(prev => ({ ...prev, [name]: isPopping }));
  };

  const selectStatus = async (emoji: string, text: string) => {
    if (!statusMenuMember) return;
    try {
      await updateDoc(doc(db, "travelData", "teamStatus"), {
        [statusMenuMember]: `${emoji} ${text}`
      });
      setStatusMenuMember(null);
      onModalToggle(false);
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (e) { console.error("Sync Error"); }
  };

  const onModalToggle = (isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  };

  const fetchFortune = async () => {
    setIsFortuneLoading(true);
    const result = await getOmikuji();
    setFortune(result);
    setIsFortuneLoading(false);
  };

  const handleAuth = async () => {
    const baggageDoc = await getDoc(doc(db, "travelData", "baggage_v3"));
    const pins = baggageDoc.exists() ? baggageDoc.data().memberPins || {} : {};
    const walletDoc = await getDoc(doc(db, "travelData", "personal_wallets_v1"));
    const walletPins = walletDoc.exists() ? walletDoc.data().pins || {} : {};
    
    const correctPin = pins[targetMember] || walletPins[targetMember];
    
    if (!correctPin || pinInput === correctPin) {
      setEditTitle(memberProfiles[targetMember]?.title || '');
      setEditPhoto(memberProfiles[targetMember]?.photo || '');
      setEditPin(correctPin || '');
      setSettingsStep('edit');
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handleAdminAuth = () => {
    if (adminPinInput === '1130') {
      setSettingsStep('admin');
      setAdminPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400; 
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setEditPhoto(compressedBase64);
        setIsImageProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!editTitle.trim()) return;
    if (editPin && editPin.length !== 4) {
        alert("PIN 碼必須為 4 位數字！");
        return;
    }

    setIsSavingProfile(true);
    try {
      const currentProfile = memberProfiles[targetMember];
      const isPhotoChanged = editPhoto !== currentProfile?.photo;
      const newPhotoLocked = currentProfile?.photoLocked || isPhotoChanged;

      await updateDoc(doc(db, "travelData", "memberProfiles"), {
        [targetMember]: { 
          title: editTitle, 
          photo: editPhoto, 
          isLocked: true,
          photoLocked: newPhotoLocked
        }
      });

      if (editPin) {
          const baggageRef = doc(db, "travelData", "baggage_v3");
          const walletRef = doc(db, "travelData", "personal_wallets_v1");
          
          const bDoc = await getDoc(baggageRef);
          const currentBPins = bDoc.exists() ? bDoc.data().memberPins || {} : {};
          await updateDoc(baggageRef, {
              memberPins: { ...currentBPins, [targetMember]: editPin }
          });

          const wDoc = await getDoc(walletRef);
          const currentWPins = wDoc.exists() ? wDoc.data().pins || {} : {};
          await updateDoc(walletRef, {
              pins: { ...currentWPins, [targetMember]: editPin }
          });
          
          localStorage.setItem(`hoya_verified_${targetMember}`, 'true');
          localStorage.setItem(`wallet_verified_${targetMember}`, 'true');
      }

      setShowSettings(false);
      setSettingsStep('select');
      setPinInput('');
      onModalToggle(false);
    } catch (e) {
      alert("儲存失敗！");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAdminResetPhoto = async (name: string) => {
    setIsAdminActionLoading(name + '-photo');
    try {
      await updateDoc(doc(db, "travelData", "memberProfiles"), {
        [`${name}.photoLocked`]: false
      });
      alert(`已成功解鎖 ${name} 的頭像修改權限！`);
    } catch (e) {
      alert("解鎖失敗！");
    } finally {
      setIsAdminActionLoading(null);
    }
  };

  const handleAdminResetPin = async (name: string) => {
    if (!window.confirm(`確定要清除 ${name} 的所有 PIN 碼設定嗎？\n這將同時解除該成員的行李清單與個人錢包密碼。`)) return;
    setIsAdminActionLoading(name + '-pin');
    try {
      const baggageRef = doc(db, "travelData", "baggage_v3");
      const walletRef = doc(db, "travelData", "personal_wallets_v1");
      
      await updateDoc(baggageRef, { [`memberPins.${name}`]: deleteField() });
      await updateDoc(walletRef, { [`pins.${name}`]: deleteField() });
      
      alert(`已成功重設 ${name} 的安全密碼！該成員現在可以重新設定密碼。`);
    } catch (e) {
      alert("重設失敗！");
    } finally {
      setIsAdminActionLoading(null);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'wallet': return <Wallet />;
      case 'checklist': return <Checklist />;
      case 'booking': return <Booking onModalToggle={onModalToggle} />;
      case 'itinerary': return <Itinerary onModalToggle={onModalToggle} />;
      case 'mission': return <Mission />;
      case 'raffle': return <Raffle onModalToggle={onModalToggle} />;
      case 'game': return <Game />;
      case 'achievement': return <Achievement />;
      default: return <Itinerary onModalToggle={onModalToggle} />;
    }
  };

  const macaronRainbow = "linear-gradient(45deg, #FF8A8A, #FFB347, #FBC02D, #D4E157, #66BB6A, #4DD0E1, #5C6BC0, #9575CD, #F06292, #FF7043)";

  return (
    <div className={`min-h-screen pb-32 max-w-md mx-auto relative overflow-x-hidden ${isOverlayOpen ? 'h-screen overflow-hidden' : ''}`}>
      <div className="h-2 w-full rainbow-bg absolute top-0 left-0 z-10" />

      {!isOverlayOpen && (
        <button
          onClick={() => setActiveTab('achievement')}
          className={`fixed left-4 bottom-28 w-14 h-14 rounded-full shadow-2xl z-[60] flex items-center justify-center border-4 border-white transition-all active:scale-90 ${activeTab === 'achievement' ? 'scale-110 ring-4 ring-rose-200 shadow-rose-200' : 'hover:scale-105'}`}
          style={{ background: macaronRainbow }}
        >
          <Trophy size={24} className="text-white drop-shadow-md" fill="currentColor" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
        </button>
      )}

      {!isOverlayOpen && (
        <header className="pt-8 pb-4 px-4 text-center animate-in fade-in duration-300 relative z-[100]">
          <div className="flex justify-between items-center px-2 mb-4">
            <button onClick={() => { setShowSettings(true); onModalToggle(true); }} className="p-2 bg-white rounded-full shadow-md text-rose-400 border border-rose-50 active:scale-90 transition-all">
              <Settings size={20} />
            </button>
            <div className="relative inline-block group">
              <div className="absolute -inset-10 bg-gradient-to-r from-pink-200 via-white to-sky-200 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-all"></div>
              <div className="flex items-center relative gap-1.5">
                <span className="text-6xl font-cute-title font-black rainbow-text select-none py-1 px-1 block leading-none tracking-tighter">HOYA</span>
                <div className="flex flex-col bg-white/90 backdrop-blur-sm px-1.5 py-1 rounded-xl border border-rose-100 shadow-sm min-w-[45px] h-[38px] justify-center items-center">
                  <span className="text-[7px] font-black text-rose-600 tracking-[0.1em] border-b border-rose-100/60 w-full text-center pb-0.5 mb-0.5 leading-none uppercase">Tokyo</span>
                  <span className="text-[7px] font-black text-rose-400 tracking-[0.1em] w-full text-center leading-none mt-0.5">2026</span>
                </div>
              </div>
            </div>
            <span className="text-3xl animate-bounce" style={{ animationDelay: '0.3s' }}>🌈</span>
          </div>

          <div className="grid grid-cols-6 gap-y-5 gap-x-1 mb-4 px-2 py-1 overflow-visible relative">
            {TEAM_MEMBERS.map((name, idx) => (
              <div key={name} className={`flex flex-col items-center gap-0.5 overflow-visible relative ${poppingMembers[name] ? 'z-[200]' : 'z-0'}`}>
                <MemberAvatar 
                  name={name} 
                  index={idx} 
                  size="w-12 h-12" 
                  className="cursor-pointer"
                  currentStatus={teamStatus[name]}
                  customTitle={memberProfiles[name]?.title}
                  customPhoto={memberProfiles[name]?.photo}
                  onPopStateChange={(isPopping) => handlePopChange(name, isPopping)}
                  onOpenStatusMenu={() => { setStatusMenuMember(name); onModalToggle(true); }}
                />
                <span className={`text-[8px] font-black uppercase tracking-tighter truncate w-full text-center ${poppingMembers[name] ? 'text-rose-500' : 'text-gray-400'}`}>{name}</span>
              </div>
            ))}
          </div>
          
          {activeTab === 'itinerary' && (
            <div className="bg-white/80 rounded-[2.5rem] p-4 inline-block w-full border border-white shadow-xl mb-6 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full rainbow-bg opacity-40"></div>
              <p className="text-[11px] text-rose-600 font-black mb-1.5 uppercase tracking-[0.2em] flex items-center justify-center gap-2 leading-none">
                <Heart size={10} fill="currentColor" /> 出發倒數計時 <Heart size={10} fill="currentColor" />
              </p>
              <div className="flex justify-center gap-4 text-gray-800 font-black">
                <div className="flex flex-col"><span className="text-3xl leading-none">{timeLeft.days}</span><span className="text-[9px] text-rose-400 mt-1 font-black leading-none">DAYS</span></div>
                <span className="text-rose-100 text-2xl font-light leading-none">|</span>
                <div className="flex flex-col"><span className="text-3xl leading-none">{timeLeft.hours}</span><span className="text-[9px] text-rose-400 mt-1 font-black leading-none">HRS</span></div>
                <span className="text-rose-100 text-2xl font-light leading-none">|</span>
                <div className="flex flex-col"><span className="text-3xl leading-none">{timeLeft.mins}</span><span className="text-[9px] text-rose-400 mt-1 font-black leading-none">MINS</span></div>
                <span className="text-rose-100 text-2xl font-light leading-none">|</span>
                <div className="flex flex-col"><span className="text-3xl leading-none">{timeLeft.secs.toString().padStart(2, '0')}</span><span className="text-[9px] text-rose-400 mt-1 font-black leading-none">SECS</span></div>
              </div>
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="flex justify-center w-full px-1 mb-4">
              <button 
                onClick={fetchFortune}
                disabled={isFortuneLoading}
                className="w-[98%] flex items-center justify-center gap-3 py-3.5 bg-gradient-to-r from-rose-500 via-rose-400 to-purple-500 hover:from-rose-600 hover:to-purple-600 text-white rounded-[1.5rem] font-black transition-all shadow-xl active:scale-95 text-base border-b-[4px] border-black/15"
              >
                {isFortuneLoading ? <Loader2 className="animate-spin" size={18} /> : <><Sparkles size={20} className="animate-pulse" /> 抽彩虹御神籤</>}
              </button>
            </div>
          )}

          {fortune && activeTab === 'itinerary' && (
            <div className="mt-4 p-6 bg-white/90 backdrop-blur-3xl rounded-[3rem] shadow-[0_35px_70px_rgba(255,182,193,0.6)] relative animate-in slide-in-from-top-16 duration-700 border-2 border-white overflow-hidden mx-1">
              <div className="absolute top-0 left-0 w-full h-1.5 rainbow-bg opacity-70"></div>
              <button onClick={() => setFortune(null)} className="absolute top-5 right-6 text-rose-300 hover:text-rose-500 transition-colors bg-white/90 rounded-full p-2 shadow-md active:scale-90"><X size={18} /></button>
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-4">
                  <Sparkles size={18} className="text-rose-400 animate-pulse" />
                  <span className="text-xs font-black text-rose-500 uppercase tracking-[0.5em]">Rainbow Oracle</span>
                  <Sparkles size={18} className="text-rose-400 animate-pulse" />
                </div>
                <p className="text-gray-700 font-bold leading-relaxed text-lg italic text-center px-2 drop-shadow-sm font-rounded">"{fortune}"</p>
                <div className="h-1.5 w-24 rainbow-bg rounded-full mt-2 opacity-50"></div>
              </div>
            </div>
          )}
        </header>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-6 bg-white animate-in slide-in-from-bottom duration-500 overflow-hidden">
           <div className="w-full h-full flex flex-col max-w-md mx-auto relative pt-14 px-7 pb-10 overflow-y-auto scrollbar-hide">
              <button onClick={() => { setShowSettings(false); setSettingsStep('select'); onModalToggle(false); }} className="fixed top-6 right-6 p-2 bg-gray-100 text-gray-400 rounded-full hover:text-gray-600 transition-colors z-[4100]"><X size={24} /></button>
              <div className="space-y-6">
                <div className="mb-2">
                  <h3 className="text-3xl font-black text-gray-800 italic flex items-center gap-3"><Fingerprint className="text-rose-400" size={32} /> 彩虹身分證</h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {settingsStep === 'select' ? '請選擇你的成員身分' : settingsStep === 'auth' ? '請輸入安全驗證碼' : settingsStep === 'admin-auth' ? '管理員身分驗證' : settingsStep === 'admin' ? '管理員救援中心' : '編輯個人資料'}
                  </p>
                </div>

                {settingsStep === 'select' && (
                  <>
                    <div className="grid grid-cols-3 gap-4 py-4">
                      {TEAM_MEMBERS.map((name, idx) => (
                        <button 
                          key={name}
                          onClick={() => { setTargetMember(name); setSettingsStep('auth'); setPinInput(''); }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-[2rem] border-2 transition-all active:scale-95 bg-white border-rose-50 shadow-sm hover:border-rose-400`}
                        >
                          <MemberAvatar name={name} index={idx} size="w-12 h-12" customPhoto={memberProfiles[name]?.photo} onOpenStatusMenu={()=>{}} disablePop />
                          <span className="text-[10px] font-black text-gray-700 uppercase">{name}</span>
                          {memberProfiles[name]?.photoLocked && <div className="absolute top-2 right-2 text-amber-500"><Lock size={10} /></div>}
                        </button>
                      ))}
                    </div>
                    <div className="pt-8 border-t border-gray-100 flex flex-col items-center gap-4">
                        <button 
                          onClick={() => { setSettingsStep('admin-auth'); setAdminPinInput(''); }}
                          className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                           <ShieldAlert size={16} /> 管理員救援中心
                        </button>
                        <p className="text-[9px] text-gray-400 font-bold italic text-center">※ 若忘記 PIN 碼或需要重設頭像，請找管理員協助</p>
                    </div>
                  </>
                )}

                {settingsStep === 'admin-auth' && (
                   <div className="flex flex-col items-center gap-8 py-10 animate-in fade-in zoom-in-95">
                      <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                        <ShieldQuestion size={48} />
                      </div>
                      <div className="text-center space-y-2">
                        <h4 className="text-2xl font-black text-gray-800 italic">進入救援中心</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">請輸入管理員 4 位數 PIN 碼</p>
                      </div>
                      <div className="w-full max-w-[240px] space-y-6">
                        <input 
                          type="password" 
                          maxLength={4}
                          inputMode="numeric"
                          value={adminPinInput}
                          autoFocus
                          onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className={`w-full bg-gray-50 border-2 rounded-3xl p-5 text-center text-4xl font-black outline-none tracking-[0.5em] transition-all ${pinError ? 'border-red-400 text-red-500 animate-shake' : 'border-amber-100 focus:border-amber-400 text-gray-700'}`}
                        />
                        <div className="flex gap-4">
                          <button onClick={() => setSettingsStep('select')} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest">返回</button>
                          <button onClick={handleAdminAuth} disabled={adminPinInput.length !== 4} className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">驗證密碼</button>
                        </div>
                      </div>
                   </div>
                )}

                {settingsStep === 'admin' && (
                   <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-20">
                      <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
                        <p className="text-xs font-bold text-amber-800 leading-relaxed">
                          管理員專屬權限：可解除頭像修改限制，或重設成員 PIN 碼。
                        </p>
                      </div>
                      <div className="space-y-4">
                         {TEAM_MEMBERS.map((name, idx) => (
                           <div key={name} className="flex flex-col p-5 bg-white rounded-3xl border border-gray-100 shadow-sm gap-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <MemberAvatar name={name} index={idx} size="w-11 h-11" customPhoto={memberProfiles[name]?.photo} onOpenStatusMenu={()=>{}} disablePop />
                                   <div className="flex flex-col">
                                      <span className="text-base font-black text-gray-700">{name}</span>
                                      <span className={`text-[9px] font-bold ${memberProfiles[name]?.photoLocked ? 'text-amber-500' : 'text-green-500'}`}>
                                         {memberProfiles[name]?.photoLocked ? '頭像已鎖定' : '頭像開放中'}
                                      </span>
                                   </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                                <button 
                                  onClick={() => handleAdminResetPhoto(name)}
                                  disabled={!memberProfiles[name]?.photoLocked || isAdminActionLoading === name + '-photo'}
                                  className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${memberProfiles[name]?.photoLocked ? 'bg-amber-500 text-white shadow-md active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                >
                                  {isAdminActionLoading === name + '-photo' ? <Loader2 size={12} className="animate-spin" /> : <><Unlock size={14} /> 解鎖頭像</>}
                                </button>
                                <button 
                                  onClick={() => handleAdminResetPin(name)}
                                  disabled={isAdminActionLoading === name + '-pin'}
                                  className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-500 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                >
                                  {isAdminActionLoading === name + '-pin' ? <Loader2 size={12} className="animate-spin" /> : <><KeyRound size={14} /> 重設 PIN</>}
                                </button>
                              </div>
                           </div>
                         ))}
                      </div>
                      <button onClick={() => setSettingsStep('select')} className="w-full py-5 bg-gray-100 text-gray-500 rounded-3xl font-black text-sm uppercase tracking-widest text-center active:scale-95 transition-all">返回身分選擇</button>
                   </div>
                )}

                {settingsStep === 'auth' && (
                   <div className="flex flex-col items-center gap-8 py-10 animate-in fade-in zoom-in-95">
                      <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 shadow-inner">
                        <Lock size={48} />
                      </div>
                      <div className="text-center space-y-2">
                        <h4 className="text-2xl font-black text-gray-800 italic">{targetMember}，是你嗎？</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">請輸入你的 4 位數 PIN 碼</p>
                      </div>
                      <div className="w-full max-w-[240px] space-y-6">
                        <input 
                          type="password" 
                          maxLength={4}
                          inputMode="numeric"
                          value={pinInput} 
                          autoFocus
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className={`w-full bg-gray-50 border-2 rounded-3xl p-5 text-center text-4xl font-black outline-none tracking-[0.5em] transition-all ${pinError ? 'border-red-400 text-red-500 animate-shake' : 'border-rose-100 focus:border-rose-400 text-gray-700'}`}
                        />
                        <div className="flex gap-4">
                          <button onClick={() => setSettingsStep('select')} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest">返回</button>
                          <button onClick={handleAuth} disabled={pinInput.length !== 4} className="flex-[2] py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">驗證身分</button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium italic text-center">※ 如果尚未設定過 PIN，則輸入任意 4 位數即可通過並開始設定</p>
                   </div>
                )}

                {settingsStep === 'edit' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-10 duration-500 pb-10">
                    <div className="flex flex-col items-center gap-6">
                       <div className="relative group">
                          <div className={`w-32 h-32 rounded-full border-4 ${memberProfiles[targetMember]?.photoLocked ? 'border-amber-400' : 'border-rose-100'} overflow-hidden bg-gray-50 shadow-xl`}>
                            {editPhoto ? <img src={editPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><UserCircle size={64} /></div>}
                          </div>
                          {!memberProfiles[targetMember]?.photoLocked ? (
                            <>
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition-all"
                              >
                                {isImageProcessing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                              </button>
                              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </>
                          ) : (
                            <div className="absolute bottom-0 right-0 w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none">
                              <Lock size={18} />
                            </div>
                          )}
                       </div>
                       <div className="flex flex-col items-center gap-1">
                          <p className="text-[11px] font-black text-rose-400 uppercase tracking-[0.2em]">
                            {memberProfiles[targetMember]?.photoLocked ? '頭像已鎖定（僅能更換一次）' : '點擊相機圖示更換頭像'}
                          </p>
                          {!memberProfiles[targetMember]?.photoLocked && (
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                               <Info size={10} /> 換過一次後將永久鎖定頭像
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2 px-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">我的專屬稱號</label>
                            <span className="text-[9px] font-bold text-rose-400">稱號可無限次修改</span>
                          </div>
                          <input 
                            type="text" 
                            value={editTitle} 
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="例如：東京最辣、爆買小能手..."
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-700 outline-none focus:border-rose-400 transition-all text-lg shadow-inner"
                          />
                       </div>

                       <div className="space-y-2 px-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">我的 4 位數 PIN 碼</label>
                            <span className="text-[9px] font-bold text-rose-400">用於保護你的清單與私帳</span>
                          </div>
                          <input 
                            type="password" 
                            maxLength={4}
                            inputMode="numeric"
                            value={editPin} 
                            onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))} 
                            placeholder="設定 4 位數密碼"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-700 outline-none focus:border-rose-400 transition-all text-lg shadow-inner tracking-[0.5em] text-center"
                          />
                       </div>

                       <button 
                         onClick={saveProfile}
                         disabled={isSavingProfile || isImageProcessing}
                         className="w-full py-6 bg-rose-500 text-white rounded-3xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl border-b-8 border-black/10 disabled:opacity-50"
                       >
                         {isSavingProfile ? <Loader2 className="animate-spin" /> : <><Save size={24} /> 儲存並同步到全團</>}
                       </button>

                       <button 
                        onClick={() => setSettingsStep('select')}
                        className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest text-center"
                       >
                        取消修改
                       </button>
                    </div>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      <main className={`p-5 relative z-10`}>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {renderContent()}
        </div>
      </main>

      {!isOverlayOpen && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[96%] max-w-md bg-white/90 backdrop-blur-2xl border border-white rounded-[2.8rem] shadow-2xl z-50 p-1.5 animate-in slide-in-from-bottom-10 duration-500">
          <ul className="flex justify-between items-center h-16 px-1">
            {[
              { id: 'wallet', label: '錢包', icon: '💰', color: '#FF8A8A' },
              { id: 'checklist', label: '行李', icon: '🧳', color: '#FFB347' },
              { id: 'booking', label: '預訂', icon: '🎫', color: '#FBC02D' },
              { id: 'itinerary', label: '行程', icon: '📅', color: '#81C784' },
              { id: 'mission', label: '挑戰', icon: '🏆', color: '#4DD0E1' },
              { id: 'raffle', label: '抽籤', icon: '✨', color: '#7986CB' },
              { id: 'game', label: '遊戲', icon: '🥂', color: '#F06292' },
            ].map((item) => (
              <li key={item.id} className="flex-1">
                <button
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full h-full flex flex-col items-center justify-center gap-0.5 transition-all duration-300 rounded-[1.8rem] py-1 ${activeTab === item.id ? 'scale-105 shadow-inner' : 'text-gray-400'}`}
                  style={{ backgroundColor: activeTab === item.id ? `${item.color}33` : 'transparent' }}
                >
                  <div className="text-lg leading-none">{item.icon}</div>
                  <span className={`text-[7px] font-black tracking-tighter ${activeTab === item.id ? 'text-gray-800' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {statusMenuMember && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => { setStatusMenuMember(null); onModalToggle(false); }}></div>
          <div className="relative z-[10000] bg-white/95 backdrop-blur-3xl rounded-[3rem] shadow-[0_40px_120px_rgba(0,0,0,0.5)] p-7 border-4 border-white flex flex-col gap-5 w-full max-w-[320px] animate-in zoom-in-90 duration-200">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-rose-50">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-rose-500 uppercase tracking-[0.2em]">{statusMenuMember}</span>
                <span className="text-sm font-black text-gray-800 italic">目前動態...</span>
              </div>
              <button onClick={() => { setStatusMenuMember(null); onModalToggle(false); }} className="p-2 bg-gray-50 text-gray-300 rounded-full hover:text-gray-500 active:scale-90"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {LIVE_STATUSES.map((status) => {
                const isSelected = teamStatus[statusMenuMember]?.startsWith(status.emoji);
                return (
                  <button
                    key={status.text}
                    onClick={() => { selectStatus(status.emoji, status.text); }}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all active:scale-90 border-2 min-h-[70px] ${isSelected ? 'bg-rose-50 border-rose-500 shadow-inner' : 'bg-white border-transparent shadow-sm'}`}
                  >
                    <span className="text-2xl leading-none mb-2 block">{status.emoji}</span>
                    <span className={`text-[9px] font-black whitespace-nowrap block text-center ${isSelected ? 'text-rose-600' : 'text-gray-400'}`}>
                      {status.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;