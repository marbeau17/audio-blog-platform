'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Library, ShoppingCart, X, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface SeriesPurchaseButtonProps {
  seriesId: string;
  seriesTitle: string;
  price: number;
  contentCount: number;
  onSuccess?: () => void;
}

export default function SeriesPurchaseButton({
  seriesId,
  seriesTitle,
  price,
  contentCount,
  onSuccess,
}: SeriesPurchaseButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Estimate per-episode price for discount indicator
  const perEpisodePrice = Math.floor(price / contentCount);

  const handlePurchase = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await api.post<{ client_secret: string }>('/payment/create-intent', {
        series_id: seriesId,
      });

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not loaded');

      const { error: stripeError } = await stripe.confirmCardPayment(res.data.client_secret, {
        payment_method: {
          card: { token: '' } as any, // In production, use Stripe Elements CardElement
        },
      });

      if (stripeError) {
        setError(stripeError.message || '決済に失敗しました');
      } else {
        setSuccess(true);
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err?.error?.detail || '決済処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setShowModal(false);
      if (success) {
        setSuccess(false);
        setError('');
      }
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => {
          setError('');
          setSuccess(false);
          setShowModal(true);
        }}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm"
      >
        <Library className="w-5 h-5" />
        シリーズ購入 ({contentCount}話)
      </button>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {success ? (
              /* Success State */
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">購入完了!</h3>
                <p className="text-gray-600 mb-6">
                  シリーズを購入しました。全 {contentCount} エピソードをお楽しみください。
                </p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-gray-800">シリーズ購入</span>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="p-1 rounded-full hover:bg-white/60 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6">
                  {/* Series Info */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{seriesTitle}</h3>
                    <p className="text-sm text-gray-500">全 {contentCount} エピソード</p>
                  </div>

                  {/* Price Breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">エピソード数</span>
                      <span className="font-medium text-gray-900">{contentCount} 話</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">1話あたり</span>
                      <span className="font-medium text-gray-900">¥{perEpisodePrice.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                      <span className="font-semibold text-gray-800">合計</span>
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          まとめ割
                        </span>
                        <span className="text-xl font-bold text-indigo-600">
                          ¥{price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handlePurchase}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          処理中...
                        </>
                      ) : (
                        `¥${price.toLocaleString()} で購入`
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
