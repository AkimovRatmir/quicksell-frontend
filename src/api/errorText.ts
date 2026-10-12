/**
 * Текст ошибки для человека.
 *
 * Бэкенд отвечает вперемешку: часть сообщений уже написана по-русски для
 * пользователя (восстановление пароля, код Kaspi), часть — английские
 * технические («Invalid credentials», тексты class-validator, ответы Kaspi).
 * Правило простое: русское показываем как есть — его писали для людей;
 * знакомое английское переводим; незнакомое английское не показываем вовсе,
 * а берём русский запасной текст экрана. Сырое «Request failed with status
 * code 500» пользователю ничего не говорит.
 */

const CYRILLIC = /[а-яё]/i;

/**
 * Известные английские сообщения бэкенда → что показываем. Порядок важен:
 * первое совпадение. Только сообщения, по которым человек может что-то
 * сделать. Общие («not found», «forbidden») сюда не пишем намеренно: запасной
 * текст экрана точнее — на странице сброса пароля «Ссылка больше не
 * действует» полезнее, чем «Не найдено».
 */
const KNOWN: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  // Вход и регистрация
  [/invalid credentials/i, 'Неверная почта или пароль'],
  [/email already registered/i, 'Этот email уже зарегистрирован. Войдите или восстановите пароль.'],
  [/must accept the public offer/i, 'Чтобы зарегистрироваться, примите условия оферты и политики конфиденциальности'],
  [/password must be longer than or equal to (\d+)/i, (m) => `Пароль должен быть не короче ${m[1]} символов`],
  [/email must be an email/i, 'Проверьте адрес электронной почты'],
  [/account no longer exists|user not found/i, 'Аккаунт не найден. Войдите заново.'],

  // Подключение Kaspi
  [/kaspi rejected the login/i, 'Kaspi не принял логин или пароль. Проверьте данные пользователя Kaspi.'],
  [/code is incorrect/i, 'Неверный код. Проверьте его и попробуйте ещё раз.'],
  [/code has expired/i, 'Срок действия кода истёк. Запросите новый.'],
  [/too many wrong attempts/i, 'Слишком много неверных попыток. Запросите новый код.'],
  [/too many code requests.*?(\d+)s/i, (m) => `Kaspi ограничил отправку кодов. Попробуйте через ${m[1]} с.`],
  [/too many code requests/i, 'Kaspi ограничил отправку кодов. Попробуйте чуть позже.'],
  [/no pending login|verification expired/i, 'Попытка входа устарела. Начните подключение заново.'],
  [/lacks cabinet access|insufficient_permissions/i, 'У этого пользователя Kaspi нет доступа к кабинету продавца.'],
  [/multiple merchants/i, 'Этот логин Kaspi управляет несколькими магазинами — такое подключение пока не поддерживается.'],
  [/no stored kaspi (credentials|login)|kaspi rejected the session|cookie (likely )?expired/i, 'Сессия Kaspi истекла. Войдите в Kaspi заново в «Настройках».'],
  [/no kaspi api token/i, 'Добавьте API-токен Kaspi, чтобы загружать заказы.'],
  [/^kaspi /i, 'Kaspi сейчас не отвечает. Попробуйте позже.'],

  // Данные и формы
  [/must be an integer/i, 'Введите целое число, без копеек'],
  [/must not be (less|greater) than|must be a positive/i, 'Значение вне допустимого диапазона'],

  // Инфраструктура
  [/too many requests|throttlerexception/i, 'Слишком много попыток. Подождите немного и попробуйте снова.'],
  [/openai|ai insights are not configured/i, 'AI-анализ временно недоступен. Попробуйте позже.'],
  [/could not send the email|email provider/i, 'Не удалось отправить письмо. Попробуйте чуть позже.'],
];

function translateOne(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  if (CYRILLIC.test(text)) return text;
  for (const [pattern, ru] of KNOWN) {
    const m = text.match(pattern);
    if (m) return typeof ru === 'function' ? ru(m) : ru;
  }
  return null;
}

/**
 * Сообщения бэкенда (строка или список от валидации) → один русский текст
 * или null, если перевести нечего и лучше показать запасной текст экрана.
 */
export function humanizeMessages(raw: string | string[]): string | null {
  const list = Array.isArray(raw) ? raw : [raw];
  const translated = [...new Set(list.map(translateOne).filter((t): t is string => Boolean(t)))];
  return translated.length ? translated.join('. ') : null;
}

/** Когда тела ответа нет или оно пустое — говорим по статусу. */
export function messageForStatus(status: number | undefined): string | null {
  if (status === undefined) return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  if (status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте чуть позже.';
  return null;
}
