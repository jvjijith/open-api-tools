'use client';

import React from 'react';
import SidebarPanel from '../../components/workspace/SidebarPanel';
import ExplorerPanel from '../../components/workspace/ExplorerPanel';
import DetailPanel from '../../components/workspace/DetailPanel';
import MonacoPanel from '../../components/workspace/MonacoPanel';

export default function WorkspacePage() {
  return (
    <main className="relative flex h-screen w-screen bg-[#030712] overflow-hidden dev-grid">
      {/* 4-Column Workspace Grid */}
      <div className="flex w-full h-full">
        {/* Panel 1: Uploads & Specs */}
        <section className="w-[280px] shrink-0 h-full border-r border-border/80">
          <SidebarPanel />
        </section>

        {/* Panel 2: Explorer list */}
        <section className="w-[320px] shrink-0 h-full border-r border-border/80">
          <ExplorerPanel />
        </section>

        {/* Panel 3: Conflict/Entities/Graph details (takes 50% of remainder) */}
        <section className="flex-1 h-full border-r border-border/80">
          <DetailPanel />
        </section>

        {/* Panel 4: Monaco YAML live preview */}
        <section className="flex-1 h-full">
          <MonacoPanel />
        </section>
      </div>
    </main>
  );
}
