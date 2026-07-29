import { Eye, Bot, GraduationCap, TrendingUp, Handshake } from 'lucide-react';

const pillars = [
  { icon: Eye, label: 'Visibility', desc: 'Real-time operational transparency across the entire ecosystem' },
  { icon: Bot, label: 'Automation', desc: 'AI-driven workflows reducing manual overhead by 60%' },
  { icon: GraduationCap, label: 'Education', desc: 'Continuous learning & knowledge distribution at scale' },
  { icon: TrendingUp, label: 'Growth', desc: 'Data-backed expansion strategies for all channels' },
  { icon: Handshake, label: 'Partnership', desc: 'Seamless collaboration between manufacturer & distributors' },
];

export default function ValueBar() {
  return (
    <div className="mt-8 bg-fusion-bg2/80 border border-white/10 rounded-xl backdrop-blur-sm">
      <div className="grid grid-cols-5 divide-x divide-white/10">
        {pillars.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex flex-col items-center text-center p-4">
            <Icon size={18} className="text-fusion-blue-light mb-1.5" />
            <span className="text-xs font-bold text-white mb-0.5">{label}</span>
            <span className="text-[10px] text-[#8BA0C4] leading-tight">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
