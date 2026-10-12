/**
 * Данные магазина, собранные мастером регистрации, до того как их отправили
 * на подключение. Подключение теперь заканчивается в «Настройках» (Kaspi
 * просит код с почты), поэтому мастер только собирает, а настройки подхватывают.
 *
 * Держим в памяти, а не в history.state или storage: здесь пароль от кабинета
 * Kaspi, и он не должен пережить перезагрузку вкладки.
 */
export interface SetupDraft {
  storeName: string;
  kaspiToken: string;
  kaspiLogin: string;
  kaspiPassword: string;
}

let draft: SetupDraft | null = null;

export function saveSetupDraft(next: SetupDraft) {
  draft = next;
}

/**
 * Читает черновик, не стирая. Стирать при чтении нельзя: в dev React StrictMode
 * вызывает инициализатор useState дважды, и второй вызов получал бы null —
 * ровно так поля и оказывались пустыми после регистрации.
 */
export function peekSetupDraft(): SetupDraft | null {
  return draft;
}

/** Стереть после успешного подключения — дальше данные живут на бэкенде. */
export function clearSetupDraft() {
  draft = null;
}
