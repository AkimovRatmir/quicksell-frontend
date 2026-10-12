import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * page — вся страница (последний рубеж вокруг приложения);
   * section — только область вкладки: боковое меню остаётся живым,
   * и из упавшего раздела можно уйти в соседний.
   */
  variant?: 'page' | 'section';
}

interface State {
  failed: boolean;
}

/**
 * Ловит ошибку рендера, чтобы вместо белого экрана человек видел, что
 * случилось и что нажать. Без неё любое `undefined.length` в одном разделе
 * гасило всё приложение целиком.
 *
 * Классовый компонент — у хуков нет аналога componentDidCatch.
 * Сбрасывается ключом снаружи: MainLayout ставит key={activeTab}, поэтому
 * переход на другую вкладку даёт разделу чистый старт.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Для разработчика: в консоли остаются и ошибка, и дерево компонентов.
    console.error('UI crashed:', error, info.componentStack);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;

    if (this.props.variant === 'section') {
      return (
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', marginBottom: 6 }}>Этот раздел не загрузился</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
            Данные не пострадали. Попробуйте ещё раз или откройте другой раздел в меню слева.
          </div>
          <button
            type="button"
            onClick={this.retry}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f7f7f8' }}>
        <div style={{ maxWidth: 380, background: '#fff', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.08)', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 18, lineHeight: 1.55 }}>
            Страница не смогла отобразиться. Ваши данные в порядке — обычно помогает перезагрузка.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
