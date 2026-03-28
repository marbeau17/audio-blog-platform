'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { api } from '@/lib/api';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentButtonProps {
  contentId: string;
  price: number;
  onSuccess?: () => void;
}

export default function PaymentButton({ contentId, price, onSuccess }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePurchase = async () => {
    setLoading(true);
    setError('');
    try {
      if (!stripePromise) {
        throw new Error('Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
      }

      const res = await api.post<{ client_secret: string }>('/payment/create-intent', { content_id: contentId });
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe の読み込みに失敗しました');

      // NOTE: In production, use Stripe Elements (CardElement) to collect card details.
      // This calls confirmCardPayment with only the client_secret, which works when
      // the PaymentIntent already has a payment_method attached (e.g., via Checkout Session)
      // or when Stripe Elements is mounted elsewhere on the page.
      const { error: stripeError } = await stripe.confirmCardPayment(res.data.client_secret);

      if (stripeError) {
        setError(stripeError.message || '決済に失敗しました');
      } else {
        onSuccess?.();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '決済処理中にエラーが発生しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handlePurchase} disabled={loading} className="btn-primary">
        {loading ? '処理中...' : `¥${price.toLocaleString()} で購入`}
      </button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
