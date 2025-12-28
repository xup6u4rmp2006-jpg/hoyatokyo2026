
import React, { useState, useEffect, useRef } from 'react';
import { TEAM_MEMBERS, PRIDE_COLORS, MEMBER_PHOTOS } from '../constants';
import { Expense } from '../types';
import { Plus, Calculator, Trash2, Receipt, CreditCard, Loader2, User, Lock, Unlock, ShieldCheck, UserCheck, Wallet as WalletIcon, X } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

interface PersonalExpense {
  id: string;
  description: string;
  amount: number;
  date: any;
}

const MemberBadge: React.FC<{ name: string; size?: string; className?: string; isLocked?: boolean; customPhoto?: string }> = ({ name, size = "w-10 h-10", className = "", isLocked = false, customPhoto }) => {
  const index = TEAM_MEMBERS.indexOf(name);
  const bgColor = PRIDE_COLORS[index !== -1 ? index % PRIDE_COLORS.length : 0];
  const photoUrl = customPhoto || MEMBER_PHOTOS[name];

  return (
    <div className={`relative flex-shrink-0 rounded-full transition-all duration-300 ${size} ${className}`}>
      {photoUrl ? (
        <div className="w-full h-full rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`w-full h-full rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-black uppercase text-xs ${bgColor}`}>
          {name[0]}
        </div>
      )}
      {isLocked && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-1 shadow-md border border-gray-100 flex items-center justify-center z-10">
          <Lock size={9} className="text-amber-500" fill="currentColor" />
        </div>
      )}
    </div>
  );
};

type WalletSubTab = 'accounting' | 'details' | 'personal';

const Wallet: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<WalletSubTab>('accounting');
  const [jpyAmount, setJpyAmount] = useState('1000');
  const [rate] = useState(0.21);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, any>>({});
  
  // 公用記帳狀態
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [payer, setPayer] = useState(TEAM_MEMBERS[0]);
  const [participants, setParticipants] = useState<string[]>(TEAM_MEMBERS);

  // 個人記帳狀態 (Privacy)
  const [selectedMember, setSelectedMember] = useState<string>(TEAM_MEMBERS[0]);
  const [personalExpenses, setPersonalExpenses] = useState<Record<string, PersonalExpense[]>>({});
  const [memberPins, setMemberPins] = useState<Record<string, string>>({});
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [newPersonalDesc, setNewPersonalDesc] = useState('');
  const [newPersonalAmount, setNewPersonalAmount] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 監聽公共錢包
    const unsubPublic = onSnapshot(doc(db, "travelData", "wallet"), (docSnap) => {
      if (docSnap.exists()) {
        setExpenses(docSnap.data().expenses || []);
      } else {
        setDoc(doc(db, "travelData", "wallet"), { expenses: [] });
      }
    });

    // 監聽個人錢包
    const unsubPersonal = onSnapshot(doc(db, "travelData", "personal_wallets_v1"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPersonalExpenses(data.expenses || {});
        setMemberPins(data.pins || {});
      } else {
        setDoc(doc(db, "travelData", "personal_wallets_v1"), { expenses: {}, pins: {} });
      }
    });

    // 監聽個人資料
    const unsubProfiles = onSnapshot(doc(db, "travelData", "memberProfiles"), (docSnap) => {
      if (docSnap.exists()) setMemberProfiles(docSnap.data());
    });

    setLoading(false);
    return () => { unsubPublic(); unsubPersonal(); unsubProfiles(); };
  }, []);

  // 驗證解鎖狀態
  useEffect(() => {
    const verifiedMember = localStorage.getItem(`wallet_verified_${selectedMember}`);
    if (verifiedMember === 'true') {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(!memberPins[selectedMember]);
    }
    setPinInput('');
    setPinError(false);
  }, [selectedMember, memberPins]);

  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = memberPins[selectedMember];
    
    if (pinInput === correctPin) {
      localStorage.setItem(`wallet_verified_${selectedMember}`, 'true');
      setIsUnlocked(true);
      setShowPinModal(false);
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || !newAmount) return;
    const expense: Expense = {
      id: Date.now().toString(),
      description: newDesc,
      amount: parseFloat(newAmount),
      payer,
      participants,
      date: new Date()
    };
    const updated = [expense, ...expenses];
    setExpenses(updated);
    await updateDoc(doc(db, "travelData", "wallet"), { expenses: updated });
    setNewDesc('');
    setNewAmount('');
    setActiveSubTab('details');
  };

  const addPersonalExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonalDesc || !newPersonalAmount || !isUnlocked) return;
    const newEntry: PersonalExpense = {
      id: Date.now().toString(),
      description: newPersonalDesc,
      amount: parseFloat(newPersonalAmount),
      date: new Date()
    };
    const updatedUserExpenses = [newEntry, ...(personalExpenses[selectedMember] || [])];
    const updatedAll = { ...personalExpenses, [selectedMember]: updatedUserExpenses };
    setPersonalExpenses(updatedAll);
    await updateDoc(doc(db, "travelData", "personal_wallets_v1"), { expenses: updatedAll });
    setNewPersonalDesc('');
    setNewPersonalAmount('');
  };

  const deleteExpense = async (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    await updateDoc(doc(db, "travelData", "wallet"), { expenses: updated });
  };

  const deletePersonalExpense = async (id: string) => {
    if (!isUnlocked) return;
    const updated = personalExpenses[selectedMember].filter(e => e.id !== id);
    const updatedAll = { ...personalExpenses, [selectedMember]: updated };
    setPersonalExpenses(updatedAll);
    await updateDoc(doc(db, "travelData", "personal_wallets_v1"), { expenses: updatedAll });
  };

  const toggleParticipant = (name: string) => {
    setParticipants(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const balances = TEAM_MEMBERS.reduce((acc, name) => {
    let balance = 0;
    expenses.forEach(exp => {
      if (exp.payer === name) balance += exp.amount;
      if (exp.participants.includes(name)) {
        balance -= exp.amount / exp.participants.length;
      }
    });
    acc[name] = balance;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-rose-300">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="font-black animate-pulse">多人錢包同步中...</p>
    </div>
  );

  const personalTotalJPY = (personalExpenses[selectedMember] || []).reduce((acc, e) => acc + e.amount, 0);
  const personalTotalTWD = Math.round(personalTotalJPY * rate);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-rose-800 px-2 flex items-center gap-3 mb-2 italic">
        <span className="p-2 rounded-xl bg-rose-100 text-xl">💰</span> 東京分帳與錢包
      </h2>

      <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-rose-100/50 shadow-sm overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveSubTab('accounting')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[1.5rem] transition-all font-black text-[10px] uppercase tracking-widest min-w-[80px] ${activeSubTab === 'accounting' ? 'bg-rose-800 text-white shadow-md' : 'text-rose-300'}`}>
          <CreditCard size={14} /> 共同記帳
        </button>
        <button onClick={() => setActiveSubTab('details')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[1.5rem] transition-all font-black text-[10px] uppercase tracking-widest min-w-[80px] ${activeSubTab === 'details' ? 'bg-rose-800 text-white shadow-md' : 'text-rose-300'}`}>
          <Receipt size={14} /> 結算明細
        </button>
        <button onClick={() => setActiveSubTab('personal')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[1.5rem] transition-all font-black text-[10px] uppercase tracking-widest min-w-[80px] ${activeSubTab === 'personal' ? 'bg-rose-500 text-white shadow-md' : 'text-rose-300'}`}>
          <User size={14} /> 個人私帳
        </button>
      </div>

      {activeSubTab === 'accounting' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-rose-50">
            <h3 className="text-lg font-black text-rose-800 mb-6 flex items-center gap-3 italic">🧮 匯率換算 (0.21)</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[10px] text-rose-400 font-black mb-1.5 uppercase">JPY 日幣</label>
                <input type="number" value={jpyAmount} onChange={(e) => setJpyAmount(e.target.value)} className="w-full bg-rose-50/30 border-2 border-rose-100 rounded-2xl p-4 text-xl font-black text-gray-700 outline-none" />
              </div>
              <div className="text-rose-200 pt-6"><Calculator size={24} /></div>
              <div className="flex-1">
                <label className="block text-[10px] text-rose-400 font-black mb-1.5 uppercase">TWD 台幣</label>
                <div className="w-full bg-white border-2 border-rose-50 rounded-2xl p-4 text-xl font-black text-rose-800 shadow-inner flex items-center justify-center">
                  {Math.round(parseFloat(jpyAmount || '0') * rate)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-rose-50">
            <h3 className="text-lg font-black text-rose-800 mb-6 flex items-center gap-3 italic">✍️ 新增共同支出</h3>
            <form onSubmit={addExpense} className="space-y-6">
              <input placeholder="例如：肉緣燒肉、地鐵票..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-base font-black outline-none focus:border-rose-400" />
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 font-black mb-1.5 uppercase px-2">金額 (JPY)</label>
                  <input type="number" placeholder="JPY" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-base font-black outline-none focus:border-rose-400" />
                </div>
                <div className="w-1/3">
                  <label className="block text-[10px] text-gray-400 font-black mb-1.5 uppercase px-2">買單者</label>
                  <select value={payer} onChange={(e) => setPayer(e.target.value)} className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs font-black text-rose-800 h-[58px] appearance-none">
                    {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4 px-2">分攤人員 ({participants.length})</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-2">
                  {TEAM_MEMBERS.map(m => {
                    const isSelected = participants.includes(m);
                    return (
                      <button 
                        key={m} 
                        type="button" 
                        onClick={() => toggleParticipant(m)} 
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'bg-rose-50 border-rose-500 shadow-sm' : 'bg-white border-gray-100 grayscale opacity-40'}`}
                      >
                        <MemberBadge name={m} size="w-11 h-11" customPhoto={memberProfiles[m]?.photo} />
                        <span className={`text-xs font-black truncate ${isSelected ? 'text-rose-700' : 'text-gray-400'}`}>{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="w-full bg-rose-800 text-white font-black py-5 rounded-3xl shadow-lg flex items-center justify-center gap-3 active:scale-95 text-lg border-b-4 border-black/10">
                <Plus size={24} strokeWidth={2.5} /> 確認新增支出
              </button>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === 'details' && (
        <div className="space-y-6 pb-20">
          <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-rose-50 relative overflow-hidden">
            <h3 className="text-lg font-black text-rose-800 flex items-center gap-3 mb-6 italic">📊 結算狀態</h3>
            <div className="grid grid-cols-2 gap-4">
              {TEAM_MEMBERS.map(name => (
                <div key={name} className="flex flex-col p-4 rounded-3xl bg-rose-50/20 border border-rose-100/50 relative group">
                  <div className="flex items-center gap-3 mb-2">
                    <MemberBadge name={name} size="w-10 h-10" customPhoto={memberProfiles[name]?.photo} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest truncate">{name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-black ${balances[name] >= 0 ? 'text-rose-600' : 'text-red-400'}`}>
                        {balances[name] >= 0 ? `+${Math.round(balances[name])}` : Math.round(balances[name])}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-300">¥</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-rose-300 uppercase tracking-[0.3em] px-4 italic">共同消費明細 History</h3>
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white p-5 rounded-[2rem] border border-rose-50 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4 truncate">
                  <MemberBadge name={exp.payer} size="w-12 h-12" customPhoto={memberProfiles[exp.payer]?.photo} />
                  <div className="truncate">
                    <p className="font-black text-gray-700 text-sm truncate">{exp.description}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">
                      <span className="text-rose-400">{exp.payer}</span> · {exp.participants.length} 人分
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-black text-rose-600 text-lg">{exp.amount}</span>
                    <span className="text-[10px] font-semibold text-rose-300 ml-1">¥</span>
                  </div>
                  <button onClick={() => deleteExpense(exp.id)} className="p-2 text-gray-200 hover:text-rose-400 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'personal' && (
        <div className="space-y-8 animate-in slide-in-from-right duration-500 pb-24">
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-5 border border-rose-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-2 px-2">
               <UserCheck size={16} className="text-rose-500" />
               <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">個人私帳模式：</span>
            </div>
            <div ref={scrollRef} className="flex gap-6 overflow-x-auto scrollbar-hide py-4 px-2">
              {TEAM_MEMBERS.map((name) => {
                const isSelected = selectedMember === name;
                const hasPin = !!memberPins[name];
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedMember(name)}
                    className={`flex-shrink-0 flex flex-col items-center gap-2.5 transition-all duration-300 ${isSelected ? 'scale-110' : 'opacity-40 grayscale'}`}
                  >
                    <MemberBadge 
                      name={name} 
                      isLocked={hasPin} 
                      size="w-12 h-12"
                      customPhoto={memberProfiles[name]?.photo}
                      className={isSelected ? 'ring-[4px] ring-rose-400 ring-offset-[3px] ring-offset-white shadow-xl' : 'ring-2 ring-transparent'} 
                    />
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-rose-600' : 'text-gray-400'}`}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!isUnlocked ? (
            <div className="bg-white rounded-[3rem] p-12 shadow-sm border border-rose-50 flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300">
               <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 shadow-inner">
                 <Lock size={40} />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black text-gray-800 italic">{selectedMember} 的私帳</h3>
                 <p className="text-xs font-bold text-gray-400">本記帳本受隱私保護，僅供本人查看。</p>
                 <p className="text-[9px] font-medium text-rose-400 mt-2">※ 若尚未設定密碼，請點擊左上角「設定」按鈕設定「彩虹身分證 PIN 碼」。</p>
               </div>
               <button 
                 onClick={() => { setShowPinModal(true); }}
                 className="px-10 py-4 bg-rose-500 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all"
               >
                 解鎖個人記帳
               </button>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-rose-50 relative overflow-hidden">
               <div className="flex justify-between items-end mb-8 px-1">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-3xl font-black text-rose-500 italic">個人錢包</h2>
                    <Unlock size={18} className="text-rose-300" />
                  </div>
                  <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">
                    {selectedMember} 的獨家秘密帳本
                  </p>
                </div>
              </div>

              <form onSubmit={addPersonalExpense} className="space-y-4 mb-10">
                <input placeholder="消費項目 (例如：藥妝代購、禮物...)" value={newPersonalDesc} onChange={(e) => setNewPersonalDesc(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-rose-400 shadow-inner" />
                <div className="flex gap-2">
                   <input type="number" placeholder="金額 (JPY)" value={newPersonalAmount} onChange={(e) => setNewPersonalAmount(e.target.value)} className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-rose-400 shadow-inner" />
                   <button type="submit" className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95"><Plus size={28} /></button>
                </div>
              </form>

              <div className="space-y-3">
                 <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em] mb-4">個人消費總覽</h3>
                 {(personalExpenses[selectedMember] || []).map(exp => (
                    <div key={exp.id} className="bg-rose-50/20 p-5 rounded-[2rem] border border-rose-50 flex justify-between items-center group transition-all">
                       <div className="flex items-center gap-4 truncate">
                          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-rose-400"><WalletIcon size={18} /></div>
                          <p className="font-black text-gray-700 text-sm truncate">{exp.description}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="text-right">
                             <p className="font-black text-rose-600 text-base leading-none">{exp.amount}<span className="text-[9px] font-bold ml-0.5">¥</span></p>
                             <p className="text-[8px] font-bold text-rose-300 mt-0.5">NT${Math.round(exp.amount * rate)}</p>
                          </div>
                          <button onClick={() => deletePersonalExpense(exp.id)} className="p-2 text-rose-100 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                       </div>
                    </div>
                 ))}
                 {(!personalExpenses[selectedMember] || personalExpenses[selectedMember].length === 0) && (
                   <div className="py-10 text-center opacity-20"><WalletIcon className="mx-auto mb-2" size={40} /><p className="text-xs font-black italic">尚無個人消費紀錄</p></div>
                 )}
              </div>

              <div className="mt-10 pt-6 border-t-2 border-dashed border-rose-100 space-y-2">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">總支出 (日幣)</span>
                    <p className="text-xl font-black text-rose-600 italic">¥{personalTotalJPY.toLocaleString()}</p>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest">換算台幣 (約)</span>
                    <p className="text-lg font-black text-rose-400 italic">NT${personalTotalTWD.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          )}

          <div className="p-8 bg-rose-50/50 rounded-[2.5rem] border border-rose-100 text-center">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
              <ShieldCheck size={14} /> 隱私加密中
            </p>
            <p className="text-[8px] font-bold text-rose-400/80 leading-relaxed italic px-4">
              個人私帳數據與「彩虹身分證」PIN 碼綁定，只需設定一次即可全站通行。
            </p>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-white animate-in fade-in duration-300">
           <div className={`bg-white w-full max-w-xs rounded-[3rem] p-8 shadow-2xl border-4 border-rose-100 transition-transform ${pinError ? 'animate-shake' : ''}`}>
              <div className="flex flex-col items-center text-center gap-5">
                 <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
                    <Lock size={32} />
                 </div>
                 <div className="space-y-1">
                   <h3 className="text-xl font-black text-gray-800 tracking-tight italic">
                     解鎖私帳
                   </h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     {selectedMember} 的 4 位數隱私保護
                   </p>
                 </div>
                 <form onSubmit={verifyPin} className="w-full space-y-5">
                    <input 
                      type="password" 
                      maxLength={4}
                      inputMode="numeric"
                      value={pinInput} 
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} 
                      placeholder="****" 
                      autoFocus 
                      className={`w-full bg-rose-50/30 border-2 rounded-2xl p-4 text-center text-3xl font-black outline-none transition-all tracking-[0.5em] ${pinError ? 'border-red-400 text-red-500' : 'border-rose-100 focus:border-rose-500 text-gray-700'}`} 
                    />
                    <div className="flex gap-3">
                       <button type="button" onClick={() => setShowPinModal(false)} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-[11px] uppercase tracking-widest">取消</button>
                       <button type="submit" disabled={pinInput.length !== 4} className="flex-[2] py-4 bg-rose-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">
                          確認解鎖
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(8px); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default Wallet;
