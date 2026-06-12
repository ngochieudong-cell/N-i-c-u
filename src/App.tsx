import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Settings, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Home, 
  Lock, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  FileText,
  Unlock,
  BookOpen,
  Award,
  Plus
} from 'lucide-react';

// --- Type Declarations ---
declare global {
  interface Window {
    confetti?: any;
    webkitAudioContext?: typeof AudioContext;
  }
}

interface Sentence {
  left: string;
  leftEn?: string;
  right: string;
  rightEn?: string;
}

interface GameItem {
  id: number;
  text: string;
  subText?: string;
}

const DEFAULT_SENTENCES: Sentence[] = [
  { left: "Bố bé là", leftEn: "Baby's dad is", right: "kỹ sư.", rightEn: "an engineer." },
  { left: "Mẹ em đang", leftEn: "My mother is", right: "nấu ăn trong bếp.", rightEn: "cooking in the kitchen." },
  { left: "Con mèo thích", leftEn: "The cat likes", right: "bắt chuột.", rightEn: "catching mice." },
  { left: "Trời hôm nay", leftEn: "The weather today", right: "rất trong xanh và mát mẻ.", rightEn: "is very clear and cool." },
  { left: "Em rất thích học", leftEn: "I really love learning", right: "môn Toán và Tiếng Việt.", rightEn: "Math and Vietnamese." },
  { left: "Bông hoa hồng", leftEn: "The beautiful rose", right: "tỏa hương thơm ngát.", rightEn: "fragrances sweetly." },
  { left: "Những chú chim hót", leftEn: "The little birds are singing", right: "líu lo trên cành cây.", rightEn: "merrily on the branches." },
  { left: "Buổi sáng, em", leftEn: "In the morning, I", right: "thức dậy lúc 6 giờ.", rightEn: "wake up at 6 o'clock." },
  { left: "Gia đình em", leftEn: "My family", right: "đi du lịch ở biển.", rightEn: "travels to the beach." },
  { left: "Chiếc áo mới của em", leftEn: "My new shirt", right: "có màu hồng rất đẹp.", rightEn: "has a very pretty pink color." }
];

const ADMIN_PIN = "123456";

// Audio Context reference defined outside component state to maintain singleton lifecycle
let audioCtx: AudioContext | null = null;

export default function App() {
  // --- States ---
  const [view, setView] = useState<'menu' | 'playing' | 'settings'>('menu');
  const [bank, setBank] = useState<Sentence[]>(() => {
    try {
      const saved = localStorage.getItem('sentenceBank');
      return saved ? JSON.parse(saved) : DEFAULT_SENTENCES;
    } catch (e) {
      return DEFAULT_SENTENCES;
    }
  });

  const [roundLefts, setRoundLefts] = useState<GameItem[]>([]);
  const [roundRights, setRoundRights] = useState<GameItem[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [shakeRightId, setShakeRightId] = useState<number | null>(null);
  const [confettiLoaded, setConfettiLoaded] = useState(false);
  const [settingsText, setSettingsText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // sound settings & kid-friendly statistics
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sound_enabled');
    return saved !== 'false';
  });
  const [score, setScore] = useState<number>(() => {
    const saved = localStorage.getItem('sentence_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // --- Load Confetti Script Dynamically ---
  useEffect(() => {
    const scriptId = 'confetti-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
      script.onload = () => setConfettiLoaded(true);
      document.body.appendChild(script);
    } else {
      setConfettiLoaded(true);
    }
  }, []);

  // Persist score changes cleanly
  useEffect(() => {
    localStorage.setItem('sentence_score', score.toString());
  }, [score]);

  // Persist sound preference
  useEffect(() => {
    localStorage.setItem('sound_enabled', soundEnabled.toString());
  }, [soundEnabled]);

  // --- Audio Synth Engine ---
  const initAudio = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch (e) {
      console.warn("Audio Context init blocked or not supported", e);
    }
  };

  const playSuccessSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      
      const playNote = (freq: number, startTime: number, duration: number) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      playNote(523.25, now, 0.08); // C5
      playNote(659.25, now + 0.08, 0.08); // E5
      playNote(783.99, now + 0.16, 0.08); // G5
      playNote(1046.50, now + 0.24, 0.25); // C6
    } catch (e) { 
      console.error("Audio error", e); 
    }
  }, [soundEnabled]);

  const playErrorSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
      osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.25); // low slide
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) { 
      console.error("Audio error", e); 
    }
  }, [soundEnabled]);

  const triggerConfetti = useCallback(() => {
    if (window.confetti && confettiLoaded) {
      try {
        window.confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff6bb5', '#ffd700', '#00e5ff', '#a468ff', '#ff5252']
        });
      } catch (e) {
        console.warn("Confetti call failed", e);
      }
    }
  }, [confettiLoaded]);

  // --- Game Mechanics ---
  const startNewRound = useCallback(() => {
    initAudio();
    
    // Choose 3 distinct random sentences
    const shuffledBank = [...bank].sort(() => 0.5 - Math.random());
    const selectedSentences = shuffledBank.slice(0, Math.min(3, shuffledBank.length));
    
    const roundItems = selectedSentences.map((s, index) => ({
      id: index,
      left: s.left,
      leftEn: s.leftEn || "",
      right: s.right,
      rightEn: s.rightEn || ""
    }));

    // Randomize sides independently
    const lefts = roundItems.map(item => ({ id: item.id, text: item.left, subText: item.leftEn })).sort(() => 0.5 - Math.random());
    const rights = roundItems.map(item => ({ id: item.id, text: item.right, subText: item.rightEn })).sort(() => 0.5 - Math.random());

    setRoundLefts(lefts);
    setRoundRights(rights);
    setMatchedIds([]);
    setSelectedLeft(null);
    setView('playing');
  }, [bank]);

  const handleLeftClick = (id: number) => {
    if (matchedIds.includes(id)) return;
    initAudio();
    setSelectedLeft(id === selectedLeft ? null : id);
  };

  const handleRightClick = (id: number) => {
    if (matchedIds.includes(id)) return;
    if (selectedLeft === null) return; 

    if (selectedLeft === id) {
      const newMatched = [...matchedIds, id];
      setMatchedIds(newMatched);
      setSelectedLeft(null);
      playSuccessSound();
      
      if (newMatched.length > 0 && newMatched.length === roundLefts.length) {
        setScore(prev => prev + 1);
        triggerConfetti();
        setTimeout(triggerConfetti, 850);
      }
    } else {
      playErrorSound();
      setShakeRightId(id);
      setTimeout(() => setShakeRightId(null), 400);
      setSelectedLeft(null);
    }
  };

  // --- Settings PIN validation ---
  const handleSettingsClick = () => {
    setPinInput("");
    setPinError(false);
    setShowPinModal(true);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setShowPinModal(false);
      const textFormat = bank.map(s => {
        const leftStr = s.leftEn ? `${s.left} (${s.leftEn})` : s.left;
        const rightStr = s.rightEn ? `${s.right} (${s.rightEn})` : s.right;
        return `${leftStr} | ${rightStr}`;
      }).join('\n');
      setSettingsText(textFormat);
      setView('settings');
      setErrorMessage(null);
    } else {
      setPinError(true);
      setPinInput("");
      setTimeout(() => setPinError(false), 450);
    }
  };

  // Safe sentence updating logic
  const saveSettings = () => {
    const lines = settingsText.split('\n');
    const newBank: Sentence[] = [];
    
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const leftPart = parts[0].trim();
        const rightPart = parts.slice(1).join('|').trim();
        if (leftPart && rightPart) {
          // Parse out subtitle in () or []
          const leftMatch = leftPart.match(/^(.*?)\s*[\(\[](.*?)[\)\]]\s*$/);
          const leftMain = leftMatch ? leftMatch[1].trim() : leftPart;
          const leftEn = leftMatch ? leftMatch[2].trim() : "";

          const rightMatch = rightPart.match(/^(.*?)\s*[\(\[](.*?)[\)\]]\s*$/);
          const rightMain = rightMatch ? rightMatch[1].trim() : rightPart;
          const rightEn = rightMatch ? rightMatch[2].trim() : "";

          newBank.push({
            left: leftMain,
            leftEn: leftEn,
            right: rightMain,
            rightEn: rightEn
          });
        }
      }
    });

    if (newBank.length >= 3) {
      setBank(newBank);
      localStorage.setItem('sentenceBank', JSON.stringify(newBank));
      setView('menu');
      setErrorMessage(null);
    } else {
      setErrorMessage("Vui lòng nhập ít nhất 3 câu hợp lệ! Mỗi câu cần gõ dạng: Vế trái (Tiếng Anh) | Vế phải (Tiếng Anh)");
    }
  };

  // Restore Default Sentences Helper
  const restoreDefaults = () => {
    setBank(DEFAULT_SENTENCES);
    localStorage.setItem('sentenceBank', JSON.stringify(DEFAULT_SENTENCES));
    const textFormat = DEFAULT_SENTENCES.map(s => {
      const leftStr = s.leftEn ? `${s.left} (${s.leftEn})` : s.left;
      const rightStr = s.rightEn ? `${s.right} (${s.rightEn})` : s.right;
      return `${leftStr} | ${rightStr}`;
    }).join('\n');
    setSettingsText(textFormat);
    setErrorMessage("Đã khôi phục lại bộ câu hỏi mặc định có phụ đề!");
    setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
  };

  const resetScore = () => {
    setScore(0);
  };

  // --- RENDERING VIEWS ---

  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-amber-100 flex flex-col justify-between p-4 md:p-8 font-sans">
        
        {/* Top Control Bar with Audio Toggle & Bilingual Logo Info */}
        <div className="max-w-5xl w-full mx-auto flex justify-between items-center animate-pop-in">
          <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full border border-pink-200/50 shadow-sm">
            <Award className="w-5 h-5 text-amber-500 fill-amber-100 animate-pulse-subtle" />
            <div className="text-left">
              <span className="text-gray-800 font-extrabold text-xs md:text-sm block leading-none">
                Cúp chiến thắng: <b className="text-pink-600 font-black text-sm md:text-base">{score}</b>
              </span>
              <span className="text-[10px] text-gray-500 font-bold tracking-tight block uppercase">
                Victorious Cups
              </span>
            </div>
            {score > 0 && (
              <button 
                onClick={resetScore}
                title="Đặt lại cúp" 
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors p-1"
                id="reset-score-btn"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 bg-white/80 p-3.5 rounded-full border border-purple-200 shadow-sm text-gray-700 hover:bg-white hover:border-purple-300 transition-all hover:scale-105 active:scale-95"
            title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
            id="audio-toggle-btn"
          >
            {soundEnabled ? (
              <Volume2 className="w-5.5 h-5.5 text-purple-600" />
            ) : (
              <VolumeX className="w-5.5 h-5.5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Main Menu Dashboard */}
        <div className="glass-panel max-w-lg w-full mx-auto rounded-3xl p-8 md:p-10 text-center shadow-2xl animate-pop-in my-auto relative overflow-hidden border border-white">
          {/* Fun colorful floating visuals */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-pink-300/30 rounded-full blur-xl"></div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-300/30 rounded-full blur-xl"></div>

          <div className="bg-gradient-to-br from-pink-100 to-amber-100 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-inner border-2 border-white hover:scale-110 transition-transform duration-300">
            <Sparkles className="w-12 h-12 text-pink-500 animate-pulse-subtle" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tight leading-tight mb-1">
            Nối Câu Vui Nhộn
          </h1>
          <p className="text-xs md:text-sm text-gray-500 uppercase tracking-widest font-extrabold mb-3">
            Fun Sentence Matcher
          </p>

          <p className="text-gray-450 text-xs font-bold tracking-tight mb-8">
            Learn and pair language structures naturally!
          </p>
          
          <div className="space-y-4 relative z-10">
            <button 
              onClick={startNewRound}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-extrabold py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl hover:from-pink-400 hover:to-indigo-550 transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer"
              id="start-match-btn"
            >
              <div className="flex items-center justify-center gap-2 text-xl md:text-2xl tracking-wide font-black">
                <Play className="w-6 h-6 fill-current animate-pulse" />
                BẮT ĐẦU CHƠI
              </div>
              <div className="text-[11px] font-bold text-pink-100 uppercase tracking-widest">
                Start pairing now
              </div>
            </button>
            
            <button 
              onClick={handleSettingsClick}
              className="w-full bg-white text-gray-700 font-bold py-4 px-6 rounded-2xl shadow-sm hover:shadow-md hover:bg-gray-50 border border-gray-200 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              id="open-settings-pin"
            >
              <div className="flex items-center justify-center gap-2 text-sm md:text-base text-gray-700 font-black">
                <Settings className="w-5 h-5 text-gray-400" />
                Thiết lập bộ câu hỏi (Giáo viên)
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                Exercise Manager (Teacher Gate)
              </div>
            </button>
          </div>

          <div className="mt-8 text-xs text-slate-500 flex items-center justify-center gap-1.5 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100/80 inline-flex">
            <BookOpen className="w-4 h-4 text-purple-500" />
            <span>
              Bộ dữ liệu: <strong className="text-purple-600 font-black">{bank.length} câu hoàn chỉnh</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">
              {bank.length} Saved pairs
            </span>
          </div>
        </div>

        {/* Footer info card */}
        <div className="max-w-md w-full mx-auto text-center mt-6">
          <p className="text-[11px] text-gray-400 font-bold leading-normal">
            Trò chơi phát triển khả năng ngôn ngữ song ngữ & tư duy liên kết logic học sinh.<br/>
            <span className="opacity-75 uppercase tracking-wider text-[9px] block mt-0.5">Bilingual Language Matching & Logic Skills Developer</span>
          </p>
        </div>

        {/* PIN Security Modal for teacher gate */}
        {showPinModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl animate-pop-in border border-gray-100">
              <div className="bg-purple-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-1 leading-none">Dành Cho Giáo Viên</h2>
              <p className="text-[10px] text-purple-600 uppercase tracking-widest font-black mb-3">Teacher Access Only</p>
              
              <p className="text-gray-500 text-xs mb-6">
                Vui lòng nhập mã PIN bảo mật để chỉnh sửa bộ câu hỏi bài tập của học sinh.<br/>
                <span className="text-gray-400 italic text-[11px]">Enter security PIN to edit questions.</span>
              </p>
              
              <form onSubmit={handlePinSubmit}>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  maxLength={6}
                  className={`w-full p-4 rounded-xl border-2 text-center text-3xl tracking-[0.4em] outline-none transition-all mb-4 ${
                    pinError ? 'border-red-400 bg-red-50 text-red-600 animate-shake' : 'border-purple-200 focus:border-purple-500 focus:bg-purple-50 text-gray-800'
                  }`}
                  autoFocus
                  required
                  id="pin-password-input"
                />
                
                {pinError && (
                  <p className="text-red-500 text-xs font-semibold mb-4 animate-shake flex items-center justify-center gap-1">
                    <XCircle className="w-4 h-4" /> Sai PIN! PIN mặc định là 123456
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer text-xs md:text-sm flex flex-col items-center justify-center"
                    id="cancel-pin-btn"
                  >
                    <span>Hủy bỏ</span>
                    <span className="text-[9px] opacity-60 uppercase font-black tracking-tight">Cancel</span>
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md transition-colors cursor-pointer text-xs md:text-sm flex flex-col items-center justify-center"
                    id="confirm-pin-btn"
                  >
                    <span>Xác nhận</span>
                    <span className="text-[9px] opacity-85 uppercase font-black tracking-tight">Confirm</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-amber-100 flex flex-col justify-between p-4 md:p-8 font-sans animate-fade-in">
        
        {/* Back and title bar */}
        <div className="max-w-4xl w-full mx-auto flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-xl border border-purple-200">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight leading-tight">
                Bộ Câu Hỏi Học Tập
              </h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                Sentence Bank Editor <span className="text-gray-300">|</span> <span className="text-purple-600 text-[10px]">Quản lý ngôn ngữ & phụ đề</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setView('menu')} 
            className="p-3.5 bg-white rounded-full hover:bg-gray-150 shadow-sm border border-gray-250/50 text-gray-600 transition hover:scale-105 active:scale-95 cursor-pointer flex flex-col items-center justify-center"
            id="back-menu-btn"
            title="Quay lại Trang chủ"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="glass-panel max-w-4xl w-full mx-auto rounded-3xl p-6 shadow-xl border border-white my-auto">
          {/* Visual Helper Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-blue-900 font-extrabold text-sm block">
                Hướng dẫn định dạng thẻ song ngữ (Bilingual Format Guide):
              </span>
              <p className="text-gray-650 text-xs md:text-sm leading-relaxed">
                Mỗi dòng đại diện cho 1 câu nối ghép đầy đủ. Tách vế Trái và vế Phải bằng ký hiệu <span className="bg-white px-2 py-0.5 border border-indigo-200 rounded text-pink-600 font-black shadow-sm mx-1">|</span>.
                <br />
                Đồng thời có thể đi kèm phụ đề tiếng anh trong dấu ngoặc đơn <span className="text-indigo-600 font-bold bg-white px-1.5 rounded">(English Translation)</span> ở sau vế đó!
                <br />
                <span className="text-indigo-900 font-black">Ví dụ đúng:</span> <code className="bg-white px-2 py-0.5 border border-indigo-100 rounded text-xs text-slate-800">Bố bé là (Baby's dad is) | kỹ sư. (an engineer.)</code>
              </p>
            </div>
          </div>

          {/* Validation Notice Bar */}
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl mb-4 text-xs md:text-sm font-bold flex items-center gap-2 animate-shake">
              <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Core Content Textarea */}
          <div className="relative">
            <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 pointer-events-none bg-purple-50/90 px-2.5 py-1 rounded-md border border-purple-200">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="text-[10px] text-purple-600 uppercase tracking-wider font-extrabold">Bộ soạn thảo / Editor</span>
            </div>
            
            <textarea
              className="w-full h-80 p-5 rounded-2xl border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-200/30 outline-none resize-y mb-4 text-gray-800 font-medium leading-relaxed font-mono text-sm tracking-wide bg-white"
              value={settingsText}
              onChange={(e) => setSettingsText(e.target.value)}
              placeholder="Vế trái câu 1 (English 1) | Vế phải câu 1 (English 1)"
              id="editor-textarea"
            ></textarea>
          </div>

          {/* Bottom Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <button
              onClick={restoreDefaults}
              className="py-4 px-6 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-2xl border border-amber-200 transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer text-sm"
              id="restore-defaults-btn"
            >
              <div className="flex items-center gap-2 font-black">
                <RotateCcw className="w-5 h-5" />
                Khôi phục mặc định
              </div>
              <div className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">
                Reset system defaults
              </div>
            </button>
            
            <button 
              onClick={saveSettings}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer text-sm"
              id="save-settings-btn"
            >
              <div className="flex items-center gap-2 font-black text-base">
                <CheckCircle2 className="w-5 h-5" />
                LƯU DỮ LIỆU & QUAY LẠI
              </div>
              <div className="text-[10px] text-teal-100 uppercase tracking-widest font-bold">
                Save exercies & return
              </div>
            </button>
          </div>
        </div>

        <div className="py-4"></div>
      </div>
    );
  }

  // --- PLAYING / GAME VIEW ---
  const isRoundComplete = matchedIds.length > 0 && matchedIds.length === roundLefts.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8 flex flex-col justify-between font-sans">
      
      {/* Top Playing Navigation/Controls */}
      <div className="max-w-6xl w-full mx-auto flex justify-between items-center mb-6 animate-pop-in">
        <button 
          onClick={() => setView('menu')}
          className="bg-white p-3 md:p-3.5 rounded-full shadow-sm hover:shadow border border-purple-250/20 text-gray-600 transition hover:scale-105 active:scale-95 cursor-pointer flex flex-col items-center justify-center"
          title="Về Trang chủ | Return to Home"
          id="play-home-btn"
        >
          <Home className="w-6 h-6" />
        </button>
        
        <div className="text-center bg-white/90 px-6 py-2.5 rounded-full border border-purple-200/50 shadow-sm flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600 animate-pulse-subtle" />
            <h2 className="text-lg md:text-xl font-black text-purple-900">
              Cùng Nối Ghép Câu Nào!
            </h2>
          </div>
          <p className="text-[10px] text-purple-600 uppercase tracking-widest font-black leading-none">
            Let's match the bilingal sentences!
          </p>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="bg-white p-3 md:p-3.5 rounded-full shadow-sm hover:shadow border border-purple-250/20 text-gray-700 transition hover:scale-105 active:scale-95 cursor-pointer flex flex-col items-center justify-center"
          title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          id="play-audio-toggle"
        >
          {soundEnabled ? (
            <Volume2 className="w-5.5 h-5.5 text-purple-600" />
          ) : (
            <VolumeX className="w-5.5 h-5.5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Main Boards layout with spacious and larger layout */}
      <div className="max-w-6xl w-full mx-auto my-auto animate-pop-in">
        
        {/* Game instructions block - dual localized */}
        <div className="text-center mb-6">
          <span className="font-extrabold text-xs md:text-sm bg-purple-100/90 text-purple-800 inline-flex flex-col md:flex-row items-center gap-2 px-6 py-3 rounded-2xl border border-purple-200 shadow-sm">
            <span>
              👉 Chạm vào 1 ô màu <strong className="text-blue-700">Xanh lam ở bên Trái</strong>, sau đó chọn phần ghép đúng màu <strong className="text-pink-600">Hồng ở bên Phải</strong>!
            </span>
            <span className="hidden md:inline text-purple-300">|</span>
            <span className="text-[11px] text-purple-600 font-bold uppercase tracking-wide">
              Tap a Left blue card, then match it with the correct Right pink card!
            </span>
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-6 lg:gap-8 relative">
          
          {/* Left Column of Choices - Column A */}
          <div className="flex-1 space-y-5">
            <div className="text-center bg-blue-100/60 py-2 px-4 rounded-xl border border-blue-200/50">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-blue-800">
                Vế Trái (Cột A)
              </h3>
              <p className="text-[9px] text-blue-600 uppercase tracking-wider font-bold leading-none mt-0.5">
                Left Side (Column A)
              </p>
            </div>

            {roundLefts.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isSelected = selectedLeft === item.id;
              
              return (
                <button
                  key={`left-${item.id}`}
                  onClick={() => handleLeftClick(item.id)}
                  disabled={isMatched}
                  className={`w-full text-left p-6 md:p-8 rounded-3xl transition-all duration-305 relative overflow-hidden flex items-center justify-between cursor-pointer border-3 min-h-[96px] md:min-h-[110px]
                    ${isMatched ? 'bg-slate-100 text-slate-350 border-slate-200 opacity-50 cursor-not-allowed scale-[0.97] shadow-none' : 
                      isSelected ? 'bg-blue-50 border-blue-500 text-blue-950 scale-[1.03] shadow-xl ring-4 ring-blue-200/70 border-3' : 
                      'bg-white border-blue-150 text-slate-800 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 border-2'
                    }
                  `}
                  id={`choice-left-${item.id}`}
                >
                  <div className="flex flex-col text-left py-1 w-full shrink pr-4">
                    {/* Vietnamese primary text: large, bold, crystal clear, high-contrast, non-blurry */}
                    <span className={`text-xl md:text-2xl font-bold tracking-tight leading-snug drop-shadow-transparent ${isMatched ? 'text-slate-400 font-medium' : 'text-slate-900 font-bold'}`}>
                      {item.text}
                    </span>
                    {/* English subtitle translation underneath */}
                    {item.subText && (
                      <span className={`text-xs md:text-sm font-medium tracking-wide mt-1.5 border-t ${isMatched ? 'text-slate-400/70 border-slate-250/60' : 'text-indigo-600/80 border-indigo-100/60'} pt-1 block leading-relaxed`}>
                        {item.subText}
                      </span>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    {isMatched ? (
                      <CheckCircle2 className="text-green-500 w-8 h-8 drop-shadow-sm" />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'bg-blue-600 border-blue-700 animate-pulse' : 'border-blue-300'}`}></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Visual decorative linking node on Desktop */}
          <div className="hidden md:flex flex-col justify-center items-center px-1">
            <div className="w-1.5 h-80 bg-gradient-to-b from-blue-200 via-purple-300 to-pink-200 rounded-full"></div>
          </div>

          {/* Right Column of Choices - Column B */}
          <div className="flex-1 space-y-5">
            <div className="text-center bg-pink-100/60 py-2 px-4 rounded-xl border border-pink-200/50">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-pink-800">
                Vế Phải (Cột B)
              </h3>
              <p className="text-[9px] text-pink-600 uppercase tracking-wider font-bold leading-none mt-0.5">
                Right Side (Column B)
              </p>
            </div>

            {roundRights.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isShake = shakeRightId === item.id;
              const isReadyToLink = selectedLeft !== null && !isMatched && !isShake;
              
              return (
                <button
                  key={`right-${item.id}`}
                  onClick={() => handleRightClick(item.id)}
                  disabled={isMatched}
                  className={`w-full text-left p-6 md:p-8 rounded-3xl transition-all duration-300 relative overflow-hidden flex items-center justify-between cursor-pointer border-3 min-h-[96px] md:min-h-[110px]
                    ${isMatched ? 'bg-emerald-50 text-emerald-950 border-emerald-400 opacity-95 cursor-not-allowed scale-[0.97] shadow-sm border-3' : 
                      isShake ? 'bg-red-50 border-red-500 text-red-900 animate-shake border-3' :
                      'bg-white border-pink-150 text-slate-800 hover:border-pink-300 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 border-2'
                    }
                    ${isReadyToLink ? 'ring-4 ring-purple-200/70 ring-offset-1 border-pink-300' : ''}
                  `}
                  id={`choice-right-${item.id}`}
                >
                  <div className="flex flex-col text-left py-1 w-full shrink pr-4">
                    {/* Vietnamese primary text: large, bold, crystal clear, high-contrast, non-blurry */}
                    <span className={`text-xl md:text-2xl font-bold tracking-tight leading-snug ${isMatched ? 'text-emerald-950 font-medium' : isShake ? 'text-red-950 font-bold' : 'text-slate-900 font-bold'}`}>
                      {item.text}
                    </span>
                    {/* English subtitle translation underneath */}
                    {item.subText && (
                      <span className={`text-xs md:text-sm font-medium tracking-wide mt-1.5 border-t pt-1 block leading-relaxed ${isMatched ? 'text-emerald-700/80 border-emerald-100/60' : 'text-pink-600/80 border-pink-100/60'}`}>
                        {item.subText}
                      </span>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    {isMatched ? (
                      <Sparkles className="text-emerald-600 w-8 h-8 animate-pulse-subtle" />
                    ) : isShake ? (
                      <XCircle className="text-red-500 w-7 h-7" />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 ${isReadyToLink ? 'bg-pink-500 border-pink-600 animate-pulse' : 'border-pink-300'}`}></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completion Modal Pop-up with dual-language summary */}
      {isRoundComplete && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-100 relative overflow-hidden animate-pop-in">
            {/* Playful graphic overlay */}
            <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500"></div>

            <div className="w-24 h-24 bg-green-100/80 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md shadow-green-100">
              <Sparkles className="w-12 h-12 text-green-500 animate-pulse-subtle" />
            </div>
            
            <h2 className="text-3xl font-black text-gray-800 mb-1 leading-tight">Tuyệt Vời Quá! 🎉</h2>
            <p className="text-[11px] text-purple-600 uppercase tracking-widest font-black mb-3">CONGRATULATIONS! 🎉</p>
            
            <p className="text-gray-600 font-bold mb-1">Bé đã hoàn thành xuất sắc trò nối câu này!</p>
            <p className="text-[11px] text-gray-400 font-bold mb-6">You have completed all language exercises perfectly!</p>
            
            <div className="bg-purple-50 rounded-2xl p-4 mb-8 flex justify-around items-center border border-purple-100/50">
              <div className="text-center">
                <span className="text-[9px] text-purple-600 uppercase tracking-widest font-extrabold block">Thành tựu</span>
                <span className="text-[8px] text-slate-400 uppercase tracking-tight block">Reward</span>
                <p className="text-gray-850 font-black text-sm flex items-center gap-1 mt-1 justify-center leading-none">
                  <Award className="w-4 h-4 text-amber-500" /> +1 Cúp
                </p>
              </div>
              <div className="w-px h-10 bg-purple-200/60"></div>
              <div className="text-center">
                <span className="text-[9px] text-purple-600 uppercase tracking-widest font-extrabold block">Tổng số cúp</span>
                <span className="text-[8px] text-slate-400 uppercase tracking-tight block">All cups</span>
                <p className="text-pink-600 font-black text-lg mt-1 leading-none">{score} cúp</p>
              </div>
            </div>

            <button
              onClick={startNewRound}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-extrabold py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer text-lg"
              id="next-round-btn"
            >
              <div className="flex items-center gap-2 font-black">
                Chơi ván tiếp theo
                <ChevronRight className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-[11px] font-bold text-pink-150 uppercase tracking-widest">
                Match the next lesson
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Help text */}
      {!isRoundComplete && (
        <div className="mt-8 text-center animate-fade-in mb-4">
           <p className="font-bold bg-white/80 text-gray-700 inline-flex flex-col md:flex-row items-center gap-1 xl:gap-2 px-6 py-3.5 rounded-full shadow-sm border border-white">
             <span>👆 Chạm vào ô bên vế Trái (Cột A) màu Xanh Lam, sau đó chọn vế Phải (Cột B) màu Hồng để ghép câu!</span>
             <span className="hidden md:inline text-gray-300">|</span>
             <span className="text-[11px] text-indigo-600 uppercase tracking-wider font-extrabold">Tap left then right card to match!</span>
           </p>
        </div>
      )}
    </div>
  );
}
