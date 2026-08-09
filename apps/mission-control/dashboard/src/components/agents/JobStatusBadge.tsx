import React from 'react';

export function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    planning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    needs_approval: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    running: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    blocked: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const style = styles[status] || styles.queued;

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}