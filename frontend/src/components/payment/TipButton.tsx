'use client';

import { useState, useRef, useEffect } from 'react';
import { Heart, Gift, Coins, X, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface TipButtonProps {
  creatorId: string;
  creatorName: string;
  contentId?: string;
}

const PRESET_AMOUNTS = [100, 500, 1000, 5000];
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 50000;

export default function TipButton({ creatorId, creatorName, contentId }: TipButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (!loading) {
          setIsOpen(false);
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, loading]);

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
        resetState();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const resetState = () => {
    setSelectedAmount(null);
    setCustomAmount('');
    setIsCustom(false);
    setError('');
  };

  const getAmount = (): number | null => {
    if (isCustom) {
      const val = parseInt(customAmount, 10);
      if (isNaN(val) || val < MIN_AMOUNT || val > MAX_AMOUNT) return null;
      return val;
    }
    return selectedAmount;
  };

  const handleSelectPreset = (amount: number) => {
    setIsCustom(false);
    setSelectedAmount(amount);
    setError('');
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setSelectedAmount(null);
    setError('');
  };

  const handleSendTip = async () => {
    const amount = getAmount();
    if (!amount) {
      setError('金額を選択してください');
      return;
    }

    if (isCustom && (amount < MIN_AMOUNT || amount > MAX_AMOUNT)) {
      setError(`¥${MIN_AMOUNT.toLocaleString()} 〜 ¥${MAX_AMOUNT.toLocaleString()} の範囲で入力してください`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/payment/tip', {
        creator_id: creatorId,
        amount,
        content_id: contentId,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'チップの送信に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const currentAmount = getAmount();

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => {
          if (!isOpen) resetState();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 transition-colors font-medium text-sm"
      >
        <Heart className="w-4 h-4" />
        応援する
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 right-0 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {success ? (
            <div className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4 animate-bounce">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">ありがとうございます!</p>
              <p className="text-sm text-gray-500">
                {creatorName} さんに ¥{currentAmount?.toLocaleString()} のチップを送りました
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-50 to-orange-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-500" />
                  <span className="font-semibold text-gray-800">
                    {creatorName} さんを応援
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-white/60 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Preset Amounts */}
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">金額を選択</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleSelectPreset(amount)}
                      disabled={loading}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                        !isCustom && selectedAmount === amount
                          ? 'border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50/50'
                      }`}
                    >
                      ¥{amount.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <button
                  onClick={handleCustomToggle}
                  disabled={loading}
                  className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg border text-sm transition-all mb-3 ${
                    isCustom
                      ? 'border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  カスタム金額
                </button>

                {isCustom && (
                  <div className="mb-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                      <input
                        type="number"
                        min={MIN_AMOUNT}
                        max={MAX_AMOUNT}
                        step={100}
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setError('');
                        }}
                        placeholder={`${MIN_AMOUNT.toLocaleString()} 〜 ${MAX_AMOUNT.toLocaleString()}`}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-red-500 text-xs mb-3">{error}</p>
                )}

                {/* Send Button */}
                <button
                  onClick={handleSendTip}
                  disabled={loading || !currentAmount}
                  className="w-full py-2.5 px-4 rounded-lg bg-pink-500 text-white font-medium text-sm hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      {currentAmount
                        ? `¥${currentAmount.toLocaleString()} を送る`
                        : 'チップを送る'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
