import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  ArrowRight, 
  Package, 
  Calendar, 
  TrendingUp, 
  MessageSquare, 
  Shield, 
  Zap, 
  Globe,
  CheckCircle2
} from 'lucide-react';

export default function Home() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="text-center max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20 text-xs font-bold mb-6 animate-bounce">
            <Zap className="w-3 h-3" />
            <span>Series A Funded & Reimagined</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
            Rent <span className="bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent">Anything</span>, Anywhere.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            The next generation rental marketplace. From high-end electronics to heavy machinery, 
            RentPi connects you with the tools you need to succeed.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <NavLink
              to="/products"
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-lg shadow-xl shadow-primary-500/25 transition-all hover:scale-105 active:scale-95 w-full sm:w-auto"
            >
              Explore Products
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </NavLink>
            <NavLink
              to="/register"
              className="flex items-center justify-center px-8 py-4 rounded-2xl glass border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all w-full sm:w-auto"
            >
              Get Started
            </NavLink>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-slate-200 dark:border-slate-800 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto px-4">
          {[
            { label: 'Transactions', value: '10M+', icon: CheckCircle2 },
            { label: 'Products', value: '500K+', icon: Package },
            { label: 'Active Users', value: '100K+', icon: Globe },
            { label: 'Security Score', value: 'Reliable', icon: Shield },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="flex justify-center mb-2">
                <stat.icon className="w-5 h-5 text-primary-500" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stat.value}</div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-500 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">Why choose RentPi?</h2>
          <p className="text-slate-500 dark:text-slate-400">Powered by advanced microservices and AI to provide the best rental experience.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Smart Availability',
              description: 'Real-time tracking of overlapping rental periods ensures you never miss a booking.',
              icon: Calendar,
              color: 'text-blue-500',
              bg: 'bg-blue-500/10',
              link: '/availability'
            },
            {
              title: 'AI-Powered Assistant',
              description: 'Our grounded AI assistant helps you find products and answers your queries with real data.',
              icon: MessageSquare,
              color: 'text-purple-500',
              bg: 'bg-purple-500/10',
              link: '/chat'
            },
            {
              title: 'Trending Analytics',
              description: 'Stay ahead of the curve with our surge detection and seasonal recommendations.',
              icon: TrendingUp,
              color: 'text-emerald-500',
              bg: 'bg-emerald-500/10',
              link: '/trending'
            },
          ].map((feature, i) => (
            <NavLink 
              key={i} 
              to={feature.link}
              className="group glass rounded-3xl p-8 border border-slate-200 dark:border-slate-700/50 hover:border-primary-500/50 hover:shadow-2xl hover:shadow-primary-500/5 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                {feature.description}
              </p>
              <div className="flex items-center gap-2 text-sm font-bold text-primary-600 dark:text-primary-400">
                Learn more <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </NavLink>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="glass rounded-[3rem] p-12 text-center relative overflow-hidden border border-primary-500/20 shadow-2xl shadow-primary-500/10">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Package className="w-64 h-64 rotate-12" />
          </div>
          
          <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6">Ready to start renting?</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto">
            Join 100,000+ users today and experience the future of the circular economy.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <NavLink
              to="/register"
              className="px-10 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              Create Account
            </NavLink>
            <NavLink
              to="/login"
              className="px-10 py-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Sign In
            </NavLink>
          </div>
        </div>
      </section>
    </div>
  );
}
