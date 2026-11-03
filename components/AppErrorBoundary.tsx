import React from 'react';
import styles from './AppErrorBoundary.module.css';

interface Props {
  children: React.ReactNode;
  resetKey?: string;
  onBack?: () => void;
  onReload?: () => void;
}

// Catch both rendering failures and rejected lazy imports. The navigation stays
// usable when a single section fails; the outer boundary also covers startup.
export class AppErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BookNook could not render a screen', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className={styles.fallback} role="alert" aria-labelledby="screen-error-title">
      <h2 id="screen-error-title">Не удалось открыть {this.props.onBack ? 'раздел' : 'BookNook'}</h2>
      <p>Попробуйте обновить страницу{this.props.onBack ? ' или вернуться на главную' : ''}.</p>
      <div className={styles.actions}>
        <button type="button" onClick={this.props.onReload || (() => window.location.reload())}>Обновить страницу</button>
        {this.props.onBack && <button type="button" onClick={this.props.onBack}>На главную</button>}
      </div>
    </section>;
  }
}
