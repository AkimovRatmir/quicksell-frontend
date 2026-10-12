import type { WeekDay } from '../lib/useOrdersDigest';

// Ступени насыщенности — от самого тихого дня недели к самому загруженному.
const SHADES = ['#DEDBF8', '#C9C4F2', '#AFA9EC', '#948CE4', '#7F77DD'];
/** День без заказов — серый. Ноль продаж это факт, а не оттенок спроса. */
const EMPTY = '#F0F0F4';
/** Сегодня без продаж: не серый, иначе не отличить от «день прошёл впустую». */
const TODAY_EMPTY = '#FAFAFE';

/**
 * Насыщенность считается в диапазоне min…max по дням, где заказы были: у
 * магазина с ровным спросом шкала от нуля покрасила бы неделю в один цвет.
 */
function shadeFor(count: number, min: number, max: number): string {
  const span = max - min;
  if (span <= 0) return SHADES[SHADES.length - 2];
  return SHADES[Math.round(((count - min) / span) * (SHADES.length - 1))];
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'заказа';
  return 'заказов';
}

/** Заказы по дням текущей недели: чем темнее, тем больше заказов. */
export function OrdersHeatmap({ week }: { week: WeekDay[] | null }) {
  if (!week) {
    return (
      <div className="heat-week">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
          <div className="heat-day" key={label}>
            <div className="heat-cell" style={{ background: EMPTY }} />
            <span className="heat-label">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  // В шкалу входят только дни с заказами: будущие ещё не наступили, а пустые
  // рисуются серым и не должны утягивать нижнюю границу к нулю.
  const active = week.filter((d) => !d.isFuture && d.count > 0).map((d) => d.count);
  const max = active.length ? Math.max(...active) : 0;
  const min = active.length ? Math.min(...active) : 0;

  return (
    <div className="heat-week">
      {week.map((day) => {
        const background = day.count > 0 ? shadeFor(day.count, min, max) : day.isToday ? TODAY_EMPTY : EMPTY;
        return (
          <div className="heat-day" key={day.key}>
            <div
              className={`heat-cell${day.isFuture ? ' future' : ''}${day.isToday ? ' today' : ''}`}
              style={day.isFuture ? undefined : { background }}
            >
              {!day.isFuture && day.count > 0 && <span className="heat-count">{day.count}</span>}
            </div>
            <span className={`heat-label${day.isToday ? ' today' : ''}`}>{day.label}</span>
            <span className="heat-tip">
              {day.isFuture
                ? `${day.fullDateLabel} — ещё не наступил`
                : `${day.fullDateLabel}: ${day.count} ${plural(day.count)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
