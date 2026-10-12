import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PAYMENT_RETURN_MESSAGE } from '../api/billing';

/**
 * Сюда FreedomPay возвращает плательщика после оплаты (pg_success_url /
 * pg_failure_url). Обычно страница открывается внутри попапа оплаты — тогда
 * она только сообщает окну QuickSell «FreedomPay закончил», а итог попап
 * узнаёт у бэкенда. Параметрам в адресе не верим: их можно подставить руками.
 *
 * Если оплата всё же ушла во всё окно (так бывает, когда банк открывает
 * 3-D Secure поверх страницы), возвращаем на вкладку «Тариф».
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const success = params.get('status') === 'success';
  const inPopup = window.parent !== window;

  useEffect(() => {
    if (inPopup) {
      window.parent.postMessage(
        { type: PAYMENT_RETURN_MESSAGE, status: success ? 'success' : 'failure' },
        window.location.origin,
      );
    } else {
      navigate('/', { replace: true, state: { tab: 'tariff' } });
    }
  }, [inPopup, success, navigate]);

  return (
    <div className="pay-return">{success ? 'Оплата прошла, проверяем…' : 'Оплата не прошла'}</div>
  );
}
