'use client';

import React from 'react';
import Link from 'next/link';
import { GitMerge, ShieldAlert, Cpu, Network, FileCode, CheckCircle2, LayoutTemplate } from 'lucide-react';

export default function LandingPortalPage() {
  return (
    <main className="relative min-h-screen w-screen bg-[#030712] text-foreground flex flex-col justify-between overflow-x-hidden dev-grid select-none">
      {/* Navbar decoration */}
      <header className="px-8 py-5 border-b border-border/60 bg-background/30 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-md shadow-primary/20">
            <FileCode size={18} />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-mono">
              APIMerge Platform
            </span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono bg-secondary/80 border border-border px-3 py-1 rounded-full">
          API Gateway Engine v1.2
        </span>
      </header>

      {/* Main Hero Launch Center */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-4xl mx-auto space-y-8">
        
        {/* Core title banner */}
        <div className="space-y-3 animate-fadeIn">
          <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-indigo-400 font-mono tracking-wider uppercase">
            Contract Orchestration Console
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent max-w-2xl leading-tight">
            Unified API spec merging platform for engineering teams.
          </h1>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Consolidate microservice specs into single gateway contracts. Validate compatibility, resolve clashing schemas visually, and compile error-free OpenAPI YAML.
          </p>
        </div>

        {/* Portal Launcher Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl pt-4 animate-scaleUp">
          
          {/* Card 1: The Main API Spec Merger (ACTIVE CARD) */}
          <Link href="/workspace" className="group block">
            <div className="relative h-full bg-[#080d1e] border-2 border-primary/30 group-hover:border-primary rounded-2xl p-6 text-left cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xl hover:shadow-primary/5 group-hover:bg-[#090f25] glow-effect">
              {/* Launcher Icon with neon glow rings */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3.5 rounded-xl text-white w-fit mb-5 shadow-lg shadow-indigo-500/25 group-hover:animate-pulse">
                <GitMerge size={24} />
              </div>
              
              <h3 className="text-base font-bold text-slate-100 group-hover:text-primary transition-colors duration-200 flex items-center gap-1.5">
                OpenAPI Spec Merger
              </h3>
              
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Parse multiple Swagger 2.0 / OpenAPI 3.x specifications, visualize models, resolve schema name clashes, and compile a single gateway yaml specification.
              </p>

              <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold mt-5 group-hover:underline">
                Launch Workspace →
              </div>
            </div>
          </Link>

          {/* Card 2: Schema Repository / Future Prototypes (PLACEHOLDER DECORATIVE) */}
          <div className="group opacity-50 relative bg-[#0b0f19]/35 border border-border/80 rounded-2xl p-6 text-left select-none">
            {/* Launcher Icon */}
            <div className="bg-secondary p-3.5 rounded-xl text-muted-foreground w-fit mb-5 border border-border/40">
              <LayoutTemplate size={24} />
            </div>
            
            <h3 className="text-base font-bold text-slate-400">
              Gateway Registry
            </h3>
            
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Store and version compiled specifications. Integrate Webhooks, manage Gateway routes, and publish unified schemas to developer portals.
            </p>

            <span className="inline-block text-[9px] bg-secondary border border-border/50 px-2 py-0.5 rounded font-mono font-bold text-muted-foreground mt-5">
              Coming Soon
            </span>
          </div>

        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl pt-8 border-t border-border/40 select-none text-left animate-fadeIn">
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-200">
              <ShieldAlert size={13} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Strict Safety</span>
            </div>
            <p className="text-[9.5px] text-muted-foreground leading-normal">Enforces OpenAPI protocol validations prior to AST parsing.</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Cpu size={13} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Canonical AST</span>
            </div>
            <p className="text-[9.5px] text-muted-foreground leading-normal">Intermediate spec representation maps format structures dynamically.</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Network size={13} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">React Flow DAG</span>
            </div>
            <p className="text-[9.5px] text-muted-foreground leading-normal">Recursive dependency graph displays linked endpoints and references.</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-200">
              <CheckCircle2 size={13} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Auto Ref Rewrite</span>
            </div>
            <p className="text-[9.5px] text-muted-foreground leading-normal">Rewrites $ref target schemas when resolving name collisions.</p>
          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-border/40 text-center text-[10px] text-muted-foreground shrink-0 select-none">
        <span>© 2026 APIMerge Platform. Built with Next.js 15 + React Flow.</span>
      </footer>
    </main>
  );
}
