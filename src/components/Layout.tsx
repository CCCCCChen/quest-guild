import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import Topbar from '@/components/Topbar';
import FloatingWidget from '@/components/FloatingWidget';
import CelebrationLayer from '@/components/CelebrationLayer';
import { useFloatingMode } from '@/hooks/useFloatingMode';
import { AnimatePresence, motion } from 'framer-motion';

export function Layout() {
  const { isFloating } = useFloatingMode();

  return (
    <SidebarProvider>
      <AnimatePresence>
        {!isFloating && (
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="contents"
          >
            <AppSidebar />
          </motion.div>
        )}
      </AnimatePresence>
      <SidebarInset className="flex flex-col min-w-0 overflow-x-hidden bg-background">
        <AnimatePresence>
          {!isFloating && (
            <motion.div
              key="topbar"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Topbar />
            </motion.div>
          )}
        </AnimatePresence>
        <main
          className={`flex-1 w-full overflow-y-auto px-4 md:px-6 lg:px-8 py-6 scroll-pt-20 transition-all duration-300 ${
            isFloating ? 'opacity-0 pointer-events-none h-0 py-0 overflow-hidden' : ''
          }`}
        >
          <Outlet />
        </main>
      </SidebarInset>
      <FloatingWidget />
      <CelebrationLayer />
    </SidebarProvider>
  );
}
