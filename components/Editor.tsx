"use client";

import {
  PanelGroup as ResizablePanelGroup,
  Panel as ResizablePanel,
  PanelResizeHandle as ResizableHandle,
} from "react-resizable-panels";
import Preview from "./Preview";
import Timeline from "./Timeline";
import MediaPanel from "./MediaPanel";
import PropertiesPanel from "./PropertiesPanel";
import EditorHeader from "./EditorHeader";
import { useEffect, useState } from "react";

export default function Editor() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"media" | "preview" | "properties">("preview");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  if (isMobile) {
    return (
      <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-gray-950 text-white">
        <EditorHeader />
        <nav className="grid h-10 shrink-0 grid-cols-3 border-b border-gray-800 bg-gray-900" aria-label="Editor panels">
          {([["media", "Media"], ["preview", "Preview"], ["properties", "Chỉnh sửa"]] as const).map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => setMobileTab(tab)} className={`text-xs font-medium ${mobileTab === tab ? "border-b-2 border-blue-500 text-blue-300" : "text-gray-400"}`}>
              {label}
            </button>
          ))}
        </nav>
        <section className="min-h-0 flex-1 overflow-hidden">
          {mobileTab === "media" ? <MediaPanel /> : mobileTab === "properties" ? <PropertiesPanel /> : <div className="h-full bg-black"><Preview /></div>}
        </section>
        <section className="h-[38dvh] min-h-[210px] max-h-[44dvh] shrink-0 border-t border-gray-800 bg-gray-900">
          <Timeline />
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-white">
      <EditorHeader />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={65} minSize={35}>
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={20} minSize={14} maxSize={35}>
                <aside className="h-full border-r border-gray-800 bg-gray-900">
                  <MediaPanel />
                </aside>
              </ResizablePanel>

              <ResizableHandle className="w-1 bg-gray-800 transition-colors hover:bg-blue-500" />

              <ResizablePanel defaultSize={55} minSize={30}>
                <div className="h-full bg-black">
                  <Preview />
                </div>
              </ResizablePanel>

              <ResizableHandle className="w-1 bg-gray-800 transition-colors hover:bg-blue-500" />

              <ResizablePanel defaultSize={25} minSize={14} maxSize={35}>
                <aside className="h-full border-l border-gray-800 bg-gray-900">
                  <PropertiesPanel />
                </aside>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="h-1 bg-gray-800 transition-colors hover:bg-blue-500" />

          <ResizablePanel defaultSize={35} minSize={18} maxSize={55}>
            <div className="h-full border-t border-gray-800 bg-gray-900">
              <Timeline />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
