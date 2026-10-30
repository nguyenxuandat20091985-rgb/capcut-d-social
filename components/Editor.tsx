"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "react-resizable-panels";
import Preview from "./Preview";
import Timeline from "./Timeline";
import MediaPanel from "./MediaPanel";
import PropertiesPanel from "./PropertiesPanel";
import EditorHeader from "./EditorHeader";

export default function Editor() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-950 text-white">
      <EditorHeader />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="vertical" className="h-full">
          {/* Main content: Media | Preview | Properties */}
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

          {/* Timeline */}
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
