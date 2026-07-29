import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white p-6">
          <div className="max-w-2xl mx-auto rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="text-xl font-bold">Mission Control error</h1>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-red-200">{this.state.error.stack || this.state.error.message}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
