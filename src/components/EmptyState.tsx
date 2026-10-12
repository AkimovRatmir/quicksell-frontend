/** Пустое состояние блока — пунктирный прямоугольник вместо строки текста. */
export function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: '1px dashed rgba(0,0,0,0.14)',
        borderRadius: 9,
        padding: '20px 14px',
        textAlign: 'center',
        fontSize: 12,
        color: '#aaa',
      }}
    >
      {text}
    </div>
  );
}
