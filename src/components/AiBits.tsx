import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AiTone, AiVerdict } from '../types/api';

/** Палитра тонов — одна на все AI-блоки, чтобы страницы не разъезжались. */
const TONES: Record<AiTone, { bg: string; color: string; mark: string }> = {
  positive: { bg: 'rgba(225,245,238,0.9)', color: '#085041', mark: '↑' },
  negative: { bg: 'rgba(250,236,231,0.9)', color: '#712B13', mark: '⚠' },
  warning: { bg: 'rgba(250,238,218,0.9)', color: '#854F0B', mark: '~' },
  neutral: { bg: 'rgba(238,237,254,0.9)', color: '#534AB7', mark: '•' },
};

// Модель может прислать тон, которого мы не знаем — не роняем вёрстку.
const toneOf = (tone: AiTone | string | undefined) => TONES[(tone as AiTone) ?? 'neutral'] ?? TONES.neutral;

/**
 * Разделители разрядов: обычный и неразрывный пробел приходят вперемешку.
 * Без скобок — подставляется и внутрь общего класса рядом с \d, и как
 * отдельный класс. Вложенные скобки JS-регулярка не понимает: `[\d[\s]]`
 * читается как класс плюс обязательная `]`, из-за чего «30 572 ₸»
 * рвалось на «30 5» и плашку «72 ₸».
 */
const SP = '\\s\\u00A0';

/**
 * Числа в AI-тексте: только проценты и суммы в тенге. Слово-единица после
 * числа заходит в ту же плашку («64% прибыли») — число в отрыве от своего
 * предмета выглядит обрубком. Счётные обороты («2 товара») остаются обычным
 * текстом, как на главной прототипа: плашка на каждом числе делает абзац
 * пёстрым, а смысл несут именно проценты и деньги.
 */
const UNIT_WORD = '(?:прибыли|выручки|расходов|маржи|заказов|товаров|SKU)';
const NUM_RE = new RegExp(`([+−–-]?\\d[\\d${SP}]*(?:[.,]\\d+)?[${SP}]*(?:%|₸)(?:[${SP}]+${UNIT_WORD})?)`, 'g');

// Смысл числа задаёт не оно само, а глагол перед ним: «прибыль снизилась на 41%»
// без знака минуса — всё равно плохая новость и должна быть красной.
const NEGATIVE_HINT = /(снизил|снижен|упал|паден|просел|сократил|уменьшил|минус|убыт|потер|ниже|хуже|прос[ае]дк)/i;
const POSITIVE_HINT = /(вырос|выросл|увеличил|рост|прибав|подрос|выше|лучше|улучшил|поднял)/i;

/** Сколько символов перед числом смотрим в поисках глагола. */
const CONTEXT_CHARS = 48;

function numTone(token: string, before: string): 'up' | 'dn' | 'neu' {
  const t = token.trim();
  if (t.startsWith('+')) return 'up';
  if (/^[−–-]/.test(t)) return 'dn';
  // Явного знака нет — решаем по ближайшему глаголу слева.
  const tail = before.slice(-CONTEXT_CHARS);
  const neg = NEGATIVE_HINT.exec(tail);
  const pos = POSITIVE_HINT.exec(tail);
  if (neg && (!pos || neg.index > pos.index)) return 'dn';
  if (pos && (!neg || pos.index > neg.index)) return 'up';
  return 'neu';
}

const BAD_COLOR = '#993C1D';
const GOOD_COLOR = '#0F6E56';

/**
 * Вердикты — короткие оценки, которые в прототипе выделены жирным и цветом.
 * Это список фраз, а не разбор смысла: модель пишет свободным текстом, и
 * вывести оценку из грамматики нельзя. Незнакомая формулировка останется
 * обычным текстом — вёрстку это не ломает.
 */
const VERDICT_BAD = ['в минус', 'в убыток', 'убыточен', 'убыточна', 'убыточный', 'ниже нормы', 'критично'];
const VERDICT_GOOD = ['стабильно', 'скрытый лидер', 'точка роста', 'точки роста', 'в норме', 'лучшая маржа'];
const VERDICT_RE = new RegExp(`(${[...VERDICT_BAD, ...VERDICT_GOOD].join('|')})`, 'gi');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Главная оценка («стабилен», «под давлением») приходит отдельным полем и
 * стоит внутри текста — её подсвечиваем по тону от модели, а не по словарю:
 * список фраз всех формулировок не покроет, а цвет должен быть верным.
 */
function verdictRe(verdict?: AiVerdict | null): RegExp {
  if (!verdict?.label) return VERDICT_RE;
  return new RegExp(`(${escapeRe(verdict.label)}|${[...VERDICT_BAD, ...VERDICT_GOOD].join('|')})`, 'gi');
}

function verdictColor(phrase: string, verdict?: AiVerdict | null): string {
  if (verdict?.label && phrase.toLowerCase() === verdict.label.toLowerCase()) {
    return verdict.tone === 'negative' ? BAD_COLOR : GOOD_COLOR;
  }
  return VERDICT_BAD.includes(phrase.toLowerCase()) ? BAD_COLOR : GOOD_COLOR;
}

/** Разметка вердиктов внутри куска обычного текста. */
function withVerdicts(chunk: string, keyBase: number, verdict?: AiVerdict | null) {
  return chunk.split(verdictRe(verdict)).map((part, i) =>
    i % 2 === 0 ? (
      <span key={`${keyBase}-t${i}`}>{part}</span>
    ) : (
      <b key={`${keyBase}-v${i}`} style={{ color: verdictColor(part, verdict) }}>
        {part}
      </b>
    ),
  );
}

/**
 * Текст инсайта с разметкой прототипа: числа в цветных плашках, оценки —
 * жирным с цветом.
 *
 * Модель отдаёт обычную строку, поэтому разметку расставляем сами. Собираем
 * React-узлы, а не HTML-строку: текст приходит от внешней модели, и
 * dangerouslySetInnerHTML на нём был бы дырой для инъекции.
 */
export function AiText({
  text,
  style,
  shortenNames,
  clampLines,
  verdict,
}: {
  text: string;
  style?: React.CSSProperties;
  /**
   * Названия товаров из каталога. Модель вставляет их в текст целиком, а
   * у поставщиков они на полстроки («… П 01 50/50, 2000x50x50 мм») — в тексте
   * такое название режем до первых слов.
   */
  shortenNames?: string[];
  /** Сколько строк показывать свёрнутым; остальное — по клику «Показать полностью». */
  clampLines?: number;
  /** Оценка состояния из headline — подсвечивается её тоном. */
  verdict?: AiVerdict | null;
}) {
  const shortened = useMemo(() => (shortenNames?.length ? abbreviateNames(text, shortenNames) : text), [text, shortenNames]);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Кнопка «Показать полностью» нужна только если текст правда не влез.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !clampLines) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [shortened, clampLines, expanded]);

  const parts = shortened.split(NUM_RE);
  let consumed = 0;
  const clampStyle: React.CSSProperties =
    clampLines && !expanded
      ? { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
      : {};
  return (
    <>
      <div ref={ref} className="qs-ai-text" style={{ ...clampStyle, ...style }}>
        {parts.map((part, i) => {
          const before = shortened.slice(0, consumed);
          consumed += part.length;
          // split с одной группой захвата чередует текст и совпадения
          if (i % 2 === 0) return <span key={i}>{withVerdicts(part, i, verdict)}</span>;
          return (
            <span key={i} className={`ai-num ${numTone(part, before)}`}>
              {part.trim()}
            </span>
          );
        })}
      </div>
      {clampLines && (overflows || expanded) && (
        <button type="button" className="qs-ai-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : 'Показать полностью'}
        </button>
      )}
    </>
  );
}

/** Длиннее этого название считаем «поставщицким» и режем в тексте. */
const NAME_KEEP_CHARS = 28;
const NAME_LONG_CHARS = 34;
/** У скольких первых слов допускаем другое окончание — модель склоняет название. */
const INFLECTED_WORDS = 3;

/**
 * Слово названия → кусок регулярки. Первые слова модель ставит в нужный
 * падеж («Вентиляционной установки приточный клапан…»), поэтому у них
 * сравниваем основу и разрешаем любое окончание; артикулы и коды — как есть.
 */
function wordPattern(word: string, inflected: boolean): string {
  if (!inflected || !/^[а-яё]{5,}$/i.test(word)) return escapeRe(word);
  return escapeRe(word.slice(0, -2)) + '[а-яё]{0,3}';
}

/**
 * Обрезка по границе слова: «Вентиляционная установка приточный клапан
 * Novaplast NovaSTYLE КИВ 125 (0205/9016)» → «Вентиляционная установка
 * приточный…» — в той форме, в какой слова стоят в тексте. Длинные названия
 * подставляем первыми, чтобы короткое не откусило кусок от длинного.
 */
function abbreviateNames(text: string, names: string[]): string {
  const long = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > NAME_LONG_CHARS))].sort((a, b) => b.length - a.length);
  let out = text;
  for (const name of long) {
    const words = name.split(/\s+/);
    if (words.length < 3) continue;
    const pattern = words.map((w, i) => wordPattern(w, i < INFLECTED_WORDS)).join('[\\s\\u00A0]+');
    out = out.replace(new RegExp(pattern, 'gi'), (match) => {
      const found = match.split(/[\s ]+/);
      const kept: string[] = [];
      for (const w of found) {
        if (kept.length >= 2 && [...kept, w].join(' ').length > NAME_KEEP_CHARS) break;
        kept.push(w);
      }
      return kept.join(' ').replace(/[\s,;:(\-–—]+$/, '') + '…';
    });
  }
  return out;
}

/**
 * Сколько тегов показываем. В прототипе их ровно три — по одному на проблему,
 * предупреждение и точку роста; больше превращает строку в кашу.
 */
const MAX_TAGS = 3;
const MAX_TAG_CHARS = 36;

/** Плашки-теги под заголовком инсайта. */
export function AiTags({ tags }: { tags: { label: string; tone: AiTone }[] }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {tags.slice(0, MAX_TAGS).map((t, i) => {
        const tone = toneOf(t.tone);
        return (
          <span
            key={`${t.label}-${i}`}
            title={t.label}
            style={{ fontSize: 11.5, background: tone.bg, color: tone.color, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}
          >
            {tone.mark} {clip(t.label, MAX_TAG_CHARS)}
          </span>
        );
      })}
    </div>
  );
}

function clip(s: string, n: number): string {
  const v = s.trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v;
}

/**
 * Значение, которого на деле нет: модель вместо пропуска поля пишет словами.
 * Показывать «Потенциал: не указано» хуже, чем не показывать ничего.
 */
export function meaningful(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || /^(не указано|нет данных|n\/?a|—|-)$/i.test(v)) return null;
  return v;
}

interface CardProps {
  title: string;
  detail: string;
  badge?: string | null;
  tone: AiTone;
  /** Строка-приписка снизу: потенциал у точек роста, ссылка-действие. */
  footer?: string | null;
  /**
   * Тонированная карточка «Точек роста» из прототипа: зелёная для позитивных
   * пунктов, фиолетовая для остальных. Без флага — серая карточка
   * «Требуют действий» с бейджем справа от названия.
   */
  tinted?: boolean;
  onClick?: () => void;
}

/** Палитра тонированных карточек — та же, что у GrowthCard на главной. */
const TINTS: Record<'good' | 'purple', { bg: string; border: string; title: string; body: string; cta: string }> = {
  good: { bg: '#F0FDF8', border: '#9FE1CB', title: '#085041', body: '#1D9E75', cta: '#0F6E56' },
  purple: { bg: '#EEEDFE', border: '#AFA9EC', title: '#3C3489', body: '#534AB7', cta: '#534AB7' },
};

/** Карточка пункта инсайта: «Требуют действий» и «Точки роста». */
export function AiItemCard({ title, detail, badge, tone, footer, tinted, onClick }: CardProps) {
  const t = toneOf(tone);
  const tint = tinted ? TINTS[tone === 'positive' ? 'good' : 'purple'] : null;
  return (
    <div
      className="act-card"
      onClick={onClick}
      style={{
        padding: '11px 13px',
        borderRadius: 9,
        background: tint?.bg ?? '#fafafa',
        borderColor: tint?.border,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}>
        <span
          style={{ fontSize: 12.5, fontWeight: 500, color: tint?.title ?? '#1a1a1a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={title}
        >
          {title}
        </span>
        {!tinted && meaningful(badge) && (
          <span style={{ fontSize: 10.5, background: t.bg, color: t.color, padding: '1px 7px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: tint?.body ?? '#888' }}>{detail}</div>
      {footer && (
        <div style={{ fontSize: 11, color: tint?.cta ?? '#7F77DD', marginTop: 5, fontWeight: tinted ? 500 : 400 }}>{footer}</div>
      )}
    </div>
  );
}
